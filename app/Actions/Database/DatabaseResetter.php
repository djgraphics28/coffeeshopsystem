<?php

namespace App\Actions\Database;

use App\Models\SystemActivity;
use App\Models\User;
use Database\Seeders\SettingsSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\Permission\PermissionRegistrar;

/**
 * Wipes the business data and every account except the admin account(s), then re-seeds the system settings.
 *
 * Kept: roles, permissions, the admin user(s) with their roles, and the migrations record.
 * Everything else (orders, menu, customers, expenses, other staff, uploaded files, settings ...) is cleared.
 */
class DatabaseResetter
{
    public const ADMIN_ROLE = 'admin';

    /** Structure/config that must survive: roles and permissions define who can do what. */
    private const KEEP_TABLES = ['migrations', 'roles', 'permissions', 'role_has_permissions'];

    /** Tables where only the rows belonging to removed users go. */
    private const PARTIAL_TABLES = ['users', 'model_has_roles', 'model_has_permissions', 'passkeys', 'sessions'];

    /**
     * @return array{tables_cleared: int, users_kept: int, users_removed: int, settings_seeded: bool}
     */
    public function reset(?User $actor = null): array
    {
        $keepIds = User::role(self::ADMIN_ROLE)->pluck('id')->all();

        if ($keepIds === []) {
            throw new RuntimeException('No admin account exists, so nothing can be reset safely.');
        }

        $usersRemoved = User::query()->whereNotIn('id', $keepIds)->count();

        // Uploaded files first: deleting the media models also deletes their files from disk.
        Media::query()->lazyById()->each(fn (Media $media) => $media->delete());
        Storage::disk('public')->deleteDirectory('payment-qr');

        $driver = DB::connection()->getDriverName();

        // Only this database's tables: on MySQL an unqualified listing spans every schema on the server.
        $schema = in_array($driver, ['mysql', 'mariadb'], true) ? DB::connection()->getDatabaseName() : null;

        $clear = collect(Schema::getTableListing($schema, schemaQualified: false))
            ->reject(fn (string $t) => in_array($t, [...self::KEEP_TABLES, ...self::PARTIAL_TABLES], true))
            ->values()
            ->all();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            // TRUNCATE commits implicitly, so MySQL cannot do this atomically: the safety backup is the safety net.
            DB::statement('SET FOREIGN_KEY_CHECKS = 0');

            try {
                $this->clearTables($clear, $driver);
                $this->removeOtherUsers($keepIds);
            } finally {
                DB::statement('SET FOREIGN_KEY_CHECKS = 1');
            }
        } else {
            DB::transaction(function () use ($clear, $keepIds, $driver) {
                if ($driver === 'sqlite') {
                    // Check foreign keys when the transaction commits rather than row by row.
                    DB::statement('PRAGMA defer_foreign_keys = ON');
                }

                $this->clearTables($clear, $driver);
                $this->removeOtherUsers($keepIds);
            });
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // The system settings go back to their defaults.
        (new SettingsSeeder)->run();

        // The audit trail was just emptied, so this entry is also the marker that a reset has happened.
        SystemActivity::record('database-reset', 'Reset the database (admin account(s), roles and permissions kept; settings re-seeded)', $actor, [
            'users_kept' => count($keepIds),
            'users_removed' => $usersRemoved,
        ]);

        return ['tables_cleared' => count($clear), 'users_kept' => count($keepIds), 'users_removed' => $usersRemoved, 'settings_seeded' => true];
    }

    /**
     * How much would be removed, for the confirmation screen.
     *
     * @return array<string, int>
     */
    public function preview(): array
    {
        $keepIds = User::role(self::ADMIN_ROLE)->pluck('id')->all();

        $count = fn (string $table): int => Schema::hasTable($table) ? DB::table($table)->count() : 0;

        return [
            'orders' => $count('orders'),
            'payments' => $count('payments'),
            'menu_items' => $count('menu_items'),
            'categories' => $count('categories'),
            'customers' => $count('customers'),
            'expenses' => $count('expenses'),
            'promos' => $count('promos'),
            'tables' => $count('tables'),
            'staff_accounts' => User::query()->whereNotIn('id', $keepIds)->count(),
        ];
    }

    /** @param  list<string>  $tables */
    private function clearTables(array $tables, string $driver): void
    {
        foreach ($tables as $table) {
            if (in_array($driver, ['mysql', 'mariadb'], true)) {
                DB::table($table)->truncate();

                continue;
            }

            DB::table($table)->delete();
        }

        if ($driver === 'sqlite' && $tables !== []) {
            DB::table('sqlite_sequence')->whereIn('name', $tables)->delete();
        }
    }

    /** @param  list<int>  $keepIds */
    private function removeOtherUsers(array $keepIds): void
    {
        $user = (new User)->getMorphClass();

        foreach (['model_has_roles', 'model_has_permissions'] as $table) {
            DB::table($table)->where(fn ($q) => $q->where('model_type', '!=', $user)->orWhereNotIn('model_id', $keepIds))->delete();
        }

        DB::table('passkeys')->whereNotIn('user_id', $keepIds)->delete();

        // Keep the kept users' sessions so the admin who ran the reset stays signed in.
        DB::table('sessions')->where(fn ($q) => $q->whereNull('user_id')->orWhereNotIn('user_id', $keepIds))->delete();

        DB::table('users')->whereNotIn('id', $keepIds)->delete();
    }
}
