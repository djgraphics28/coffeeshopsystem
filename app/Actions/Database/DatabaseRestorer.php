<?php

namespace App\Actions\Database;

use Generator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use ZipArchive;

/**
 * Loads a backup made by spatie/laravel-backup (a mysqldump inside a zip) back into the database, replacing everything.
 *
 * The dump is screened line by line BEFORE the current tables are touched, and the mysql client is run with its own
 * local commands (`system`, `source`, `\!` ...) switched off, so a tampered backup cannot run anything but the
 * table definitions and rows a normal dump contains.
 */
class DatabaseRestorer
{
    /** First word of every statement a normal mysqldump writes at the start of a line. */
    private const ALLOWED_STATEMENTS = ['DROP', 'CREATE', 'LOCK', 'UNLOCK', 'INSERT', 'REPLACE', 'SET', 'ALTER', 'COMMIT', 'START', 'BEGIN'];

    /** @throws RuntimeException when the backup can't be read, looks unsafe, or mysql fails (unsafe backups change nothing) */
    public function restore(string $zipPath): void
    {
        $connection = $this->connection();
        $work = storage_path('app/backup-temp/restore-'.Str::uuid());
        File::ensureDirectoryExists($work, 0700);

        try {
            // Everything that can be checked is checked before a single table is dropped.
            $sqlFile = $this->extractSafeSql($zipPath, $work);

            Schema::dropAllTables();

            $input = fopen($sqlFile, 'rb');

            try {
                $result = Process::timeout(3600)
                    ->env(['MYSQL_PWD' => (string) ($connection['password'] ?? '')])
                    ->input($input)
                    ->run($this->command($connection));
            } finally {
                fclose($input);
            }

            if ($result->failed()) {
                throw new RuntimeException('The database could not be restored. '.$this->reason($result->errorOutput() ?: $result->output()));
            }
        } finally {
            File::deleteDirectory($work);
        }

        // Every table was recreated, so connections must not reuse anything built against the old ones.
        DB::purge();
        DB::reconnect();
    }

    /**
     * Streams the dump out of the zip into a plain SQL file, checking every line on the way.
     *
     * @return string path of the cleaned SQL file
     */
    private function extractSafeSql(string $zipPath, string $work): string
    {
        $zip = new ZipArchive;

        if ($zip->open($zipPath) !== true) {
            throw new RuntimeException('The backup file could not be opened.');
        }

        if ($password = config('backup.backup.password')) {
            $zip->setPassword((string) $password);
        }

        $entry = DatabaseBackup::dumpEntryName($zip);
        $stream = $entry ? $zip->getStream($entry) : false;

        if (! $stream) {
            $zip->close();

            throw new RuntimeException('The backup does not contain a database dump (or it is encrypted with a different password).');
        }

        $raw = $work.'/dump.raw';
        file_put_contents($raw, $stream);
        fclose($stream);
        $zip->close();

        $out = fopen($work.'/restore.sql', 'wb');

        try {
            foreach (self::sanitize($this->lines($raw, str_ends_with((string) $entry, '.gz'))) as $line) {
                fwrite($out, $line);
            }
        } finally {
            fclose($out);
        }

        return $work.'/restore.sql';
    }

    /** @return Generator<int, string> lines including their newline, however long they are */
    private function lines(string $path, bool $gzip): Generator
    {
        $handle = $gzip ? gzopen($path, 'rb') : fopen($path, 'rb');

        if (! $handle) {
            throw new RuntimeException('The database dump could not be read.');
        }

        $buffer = '';

        try {
            while (! ($gzip ? gzeof($handle) : feof($handle))) {
                $chunk = $gzip ? gzread($handle, 1 << 20) : fread($handle, 1 << 20);

                if ($chunk === false || $chunk === '') {
                    break;
                }

                $buffer .= $chunk;

                while (($pos = strpos($buffer, "\n")) !== false) {
                    yield substr($buffer, 0, $pos + 1);
                    $buffer = substr($buffer, $pos + 1);
                }
            }

            if ($buffer !== '') {
                yield $buffer;
            }
        } finally {
            $gzip ? gzclose($handle) : fclose($handle);
        }
    }

    /**
     * Refuses anything a normal dump never contains. mysqldump writes one statement per line for data and
     * table-by-table DDL, so a strict allow-list is safe; anything else is rejected rather than guessed at.
     *
     * @param  iterable<string>  $lines
     * @return Generator<int, string>
     *
     * @throws RuntimeException on unsafe content
     */
    public static function sanitize(iterable $lines): Generator
    {
        foreach ($lines as $line) {
            $trimmed = trim($line);

            if ($trimmed === '' || str_starts_with($trimmed, '--')) {
                yield $line;

                continue;
            }

            $statement = $trimmed;

            if (preg_match('#^/\*M?!\d*\s*(.*?)\s*\*/;?$#s', $trimmed, $m)) {
                // Versioned comments (/*!40101 ... */) are executed by the server, so check what is inside them.
                $statement = $m[1];
            } elseif (str_starts_with($trimmed, '/*')) {
                // A plain comment.
                yield $line;

                continue;
            }

            // Server-wide settings (e.g. GTID_PURGED written by mysqldump on replicated servers) are never applied.
            if (preg_match('/^SET\s+(@@(GLOBAL|PERSIST(_ONLY)?)\.|GLOBAL\s|PERSIST(_ONLY)?\s)/i', $statement)) {
                continue;
            }

            self::assertSafe($statement, $line);

            yield $line;
        }
    }

    private static function assertSafe(string $statement, string $line): void
    {
        $isData = (bool) preg_match('/^(INSERT|REPLACE)\s/i', $statement);

        if (stripos($statement, 'LOAD_FILE') !== false) {
            throw new RuntimeException('The backup contains a statement that reads server files, so it was not restored.');
        }

        if (! $isData && preg_match('/\b(INTO\s+(OUTFILE|DUMPFILE)|LOAD\s+DATA|PROGRAM)\b/i', $statement)) {
            throw new RuntimeException('The backup contains a statement that reads or writes server files, so it was not restored.');
        }

        // Lines inside a CREATE TABLE (column and key definitions) start with whitespace, a backtick or a bracket.
        if ($line !== ltrim($line) || str_contains('`);(', $statement[0])) {
            return;
        }

        if (! ctype_alpha($statement[0])) {
            throw new RuntimeException('The backup contains a command that is not allowed, so it was not restored.');
        }

        $word = strtoupper((string) strtok($statement, " \t\n("));

        if (! in_array($word, self::ALLOWED_STATEMENTS, true)) {
            throw new RuntimeException("The backup contains a \"{$word}\" statement, which a normal backup never has, so it was not restored.");
        }

        $rules = [
            'DROP' => '/^DROP\s+TABLE\b/i',
            'CREATE' => '/^CREATE\s+TABLE\b/i',
            'ALTER' => '/^ALTER\s+TABLE\b/i',
            'SET' => '/^SET\s+(@|NAMES\b|SQL_MODE\b|TIME_ZONE\b|FOREIGN_KEY_CHECKS\b|UNIQUE_CHECKS\b|CHARACTER_SET_CLIENT\b|CHARACTER_SET_RESULTS\b|COLLATION_CONNECTION\b|SQL_NOTES\b|AUTOCOMMIT\b)/i',
            'INSERT' => '/^INSERT\s+(IGNORE\s+)?INTO\s+`[^`]+`/i',
            'REPLACE' => '/^REPLACE\s+INTO\s+`[^`]+`/i',
        ];

        if (isset($rules[$word]) && ! preg_match($rules[$word], $statement)) {
            throw new RuntimeException("The backup contains a \"{$word}\" statement that is not allowed, so it was not restored.");
        }
    }

    /**
     * @param  array<string, mixed>  $connection
     * @return list<string>
     */
    private function command(array $connection): array
    {
        $command = [DatabaseBackup::clientBinary('mysql'), '-u', (string) $connection['username'], '--default-character-set=utf8mb4', '--commands=0'];

        if (! empty($connection['unix_socket'])) {
            array_push($command, '-S', (string) $connection['unix_socket']);
        } else {
            array_push($command, '-h', (string) $connection['host'], '-P', (string) $connection['port']);
        }

        $command[] = (string) $connection['database'];

        return $command;
    }

    /** The useful line of mysql's output: its ERROR, not the warnings before it. */
    private function reason(string $output): string
    {
        $errors = collect(preg_split('/\R/', $output))->filter(fn ($l) => str_contains((string) $l, 'ERROR'))->take(2)->implode(' ');

        return Str::limit(trim($errors !== '' ? $errors : $output), 400);
    }

    /** @return array<string, mixed> */
    private function connection(): array
    {
        $config = config('database.connections.'.config('database.default'));

        if (! in_array($config['driver'] ?? null, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Restoring a backup is only supported on MySQL / MariaDB.');
        }

        return $config;
    }
}
