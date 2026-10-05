<?php

namespace App\Actions\Database;

use Carbon\Carbon;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use ZipArchive;

/**
 * Thin wrapper around spatie/laravel-backup: creates database-only backups and manages the files on the
 * dedicated `backups` disk. Kept as a class so tests can swap it (there is no mysqldump in the test run).
 */
class DatabaseBackup
{
    /** Where mysqldump / mysql usually live; used when DB_DUMP_BINARY_PATH is not set. */
    private const BINARY_DIRECTORIES = ['/opt/homebrew/bin', '/opt/homebrew/opt/mysql/bin', '/usr/local/bin', '/usr/local/mysql/bin', '/usr/bin', '/Applications/XAMPP/xamppfiles/bin'];

    public function disk(): Filesystem
    {
        return Storage::disk('backups');
    }

    private function directory(): string
    {
        return (string) config('backup.backup.name');
    }

    /**
     * Runs a database-only backup and returns the new file's name.
     *
     * @throws RuntimeException when the dump fails (for example mysqldump is missing)
     */
    public function run(): string
    {
        self::ensureBinaryPath();

        $before = collect($this->list())->pluck('name')->all();

        $code = Artisan::call('backup:run', ['--only-db' => true, '--disable-notifications' => true]);

        $created = collect($this->list())->pluck('name')->diff($before)->first();

        if ($code !== 0 || ! $created) {
            $output = trim(Artisan::output());

            throw new RuntimeException($output !== '' ? $output : 'The backup command did not create a file.');
        }

        return $created;
    }

    /**
     * Makes sure the MySQL client tools can be found (a web server's PATH is often shorter than a terminal's).
     */
    public static function ensureBinaryPath(): void
    {
        $key = 'database.connections.'.config('database.default').'.dump.dump_binary_path';

        if (config($key)) {
            return;
        }

        foreach (self::BINARY_DIRECTORIES as $directory) {
            if (is_executable($directory.'/mysqldump')) {
                config([$key => $directory]);

                return;
            }
        }
    }

    /** Folder that holds the `mysql` client, or null to rely on PATH. */
    public static function clientBinary(string $name): string
    {
        $directory = (string) config('database.connections.'.config('database.default').'.dump.dump_binary_path');

        if ($directory === '') {
            self::ensureBinaryPath();
            $directory = (string) config('database.connections.'.config('database.default').'.dump.dump_binary_path');
        }

        return $directory !== '' ? rtrim($directory, '/').'/'.$name : $name;
    }

    /**
     * @return list<array{name: string, size: int, created_at: string}>
     */
    public function list(): array
    {
        return collect($this->disk()->files($this->directory()))
            ->filter(fn (string $path) => str_ends_with($path, '.zip'))
            ->map(fn (string $path) => [
                'name' => basename($path),
                'size' => (int) $this->disk()->size($path),
                'created_at' => Carbon::createFromTimestamp($this->disk()->lastModified($path))->toIso8601String(),
            ])
            ->sortByDesc('created_at')
            ->values()
            ->all();
    }

    /** Relative path of an existing backup, or null. The name is checked so it can never point outside the folder. */
    public function path(string $name): ?string
    {
        if (! preg_match('/^[A-Za-z0-9._-]+\.zip$/', $name)) {
            return null;
        }

        $path = $this->directory().'/'.$name;

        return $this->disk()->exists($path) ? $path : null;
    }

    /** Absolute path of a stored backup (the restore needs a real file), or null. */
    public function absolutePath(string $name): ?string
    {
        $path = $this->path($name);

        return $path === null ? null : $this->disk()->path($path);
    }

    /** Name of the database dump inside a backup zip, or null when there isn't one. */
    public static function dumpEntryName(ZipArchive $zip): ?string
    {
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string) $zip->getNameIndex($i);

            if (preg_match('#^db-dumps/[^/]+\.sql(\.gz)?$#', $name)) {
                return $name;
            }
        }

        return null;
    }

    /**
     * Stores an uploaded backup zip so it shows up in the list (and can then be restored). The file is checked to
     * really be a backup with a database dump inside, and it is saved under a name we choose, never the uploaded one.
     *
     * @throws RuntimeException when the file isn't a usable backup
     */
    public function import(UploadedFile $file): string
    {
        $zip = new ZipArchive;

        if ($zip->open($file->getRealPath()) !== true) {
            throw new RuntimeException('That file is not a valid zip archive.');
        }

        if ($password = config('backup.backup.password')) {
            $zip->setPassword((string) $password);
        }

        $entry = self::dumpEntryName($zip);
        $readable = $entry !== null && $zip->getFromName($entry, 1) !== false;
        $zip->close();

        if ($entry === null) {
            throw new RuntimeException('That zip does not contain a database dump, so it is not a backup made by this system.');
        }

        if (! $readable) {
            throw new RuntimeException('The database dump inside could not be read. If the backup is password-protected, it must use the same backup password as this server.');
        }

        $name = 'imported-'.now()->format('Y-m-d-H-i-s').'.zip';
        $stream = fopen($file->getRealPath(), 'rb');
        $this->disk()->put($this->directory().'/'.$name, $stream);
        fclose($stream);

        return $name;
    }

    public function delete(string $name): bool
    {
        $path = $this->path($name);

        return $path !== null && $this->disk()->delete($path);
    }
}
