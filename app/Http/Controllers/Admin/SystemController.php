<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Database\DatabaseBackup;
use App\Actions\Database\DatabaseResetter;
use App\Actions\Database\DatabaseRestorer;
use App\Http\Controllers\Controller;
use App\Models\SystemActivity;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Database backups, restore and reset. Admin-only (the whole admin panel group is), and the destructive actions
 * additionally need the admin's own password and a typed confirmation word.
 */
class SystemController extends Controller
{
    public const RESET_WORD = 'RESET';

    public const RESTORE_WORD = 'RESTORE';

    public const SEED_WORD = 'SEED';

    /**
     * Seeders that can be run from the screen. Only these are allowed, so the page cannot be used to run any class.
     * All of them add what is missing and leave existing rows alone, except where `warning` says otherwise.
     *
     * @var array<string, array{label: string, description: string, warning: string|null}>
     */
    public const SEEDERS = [
        'RolePermissionSeeder' => ['label' => 'Roles & permissions', 'description' => 'Creates any missing permission (for example new report permissions) and the standard roles.', 'warning' => 'Resets the permissions of the admin, cashier, kitchen and barista roles to their defaults. Permissions you changed on the Roles page for those roles are lost.'],
        'SettingsSeeder' => ['label' => 'System settings', 'description' => 'Adds any missing default setting (café name, tax rate, HR settings). Existing values are kept.', 'warning' => null],
        'CategorySeeder' => ['label' => 'Menu categories', 'description' => 'Adds the sample categories that do not exist yet.', 'warning' => null],
        'AddonSeeder' => ['label' => 'Add-ons', 'description' => 'Adds the sample add-on groups and add-ons that do not exist yet.', 'warning' => null],
        'MenuItemSeeder' => ['label' => 'Sample menu items', 'description' => 'Adds the sample menu items that do not exist yet. Needs the categories and add-ons first.', 'warning' => null],
        'TableSeeder' => ['label' => 'Tables', 'description' => 'Adds the sample dine-in tables that do not exist yet.', 'warning' => null],
        'UserSeeder' => ['label' => 'Default staff accounts', 'description' => 'Creates the demo admin, cashier and kitchen accounts if they are missing.', 'warning' => 'The demo accounts use the password "password". Do not run this on a live system unless you change those passwords right after.'],
    ];

    public function __construct(private readonly DatabaseBackup $backups) {}

    public function index(Request $request, DatabaseResetter $resetter): Response
    {
        Gate::authorize('view system');

        $user = $request->user();

        return Inertia::render('Admin/System', [
            'backups' => $this->backups->list(),
            'activity' => SystemActivity::query()->latest('id')->limit(20)->get(['id', 'event', 'description', 'user_name', 'properties', 'created_at']),
            'reset_preview' => $resetter->preview(),
            'info' => [
                'database' => DB::connection()->getDatabaseName(),
                'driver' => DB::connection()->getDriverName(),
                'schedule' => 'Every day at 1:30 AM (old backups are pruned at 1:00 AM)',
                'retention' => 'All backups for 7 days, then daily, weekly and monthly ones',
                'encrypted' => (bool) config('backup.backup.password'),
            ],
            'seeders' => collect(self::SEEDERS)->map(fn (array $seeder, string $class) => ['class' => $class] + $seeder)->values(),
            'words' => ['reset' => self::RESET_WORD, 'restore' => self::RESTORE_WORD, 'seed' => self::SEED_WORD],
            'can' => [
                'manage_backups' => $user->can('manage backups'),
                'restore' => $this->isOwner($user, 'restore database'),
                'reset' => $this->isOwner($user, 'reset database'),
                'seed' => $this->isOwner($user, 'run seeders'),
            ],
        ]);
    }

    public function storeBackup(Request $request): JsonResponse
    {
        Gate::authorize('manage backups');

        try {
            $name = $this->backups->run();
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => 'The backup failed: '.str($e->getMessage())->limit(300)], 500);
        }

        SystemActivity::record('backup-created', "Created database backup {$name}", $request->user(), ['file' => $name]);

        return response()->json(['data' => collect($this->backups->list())->firstWhere('name', $name)], 201);
    }

    /** Upload a backup zip made elsewhere. It is only stored (and checked); restoring it is a separate, confirmed step. */
    public function importBackup(Request $request): JsonResponse
    {
        Gate::authorize('manage backups');

        $request->validate([
            'file' => ['required', 'file', 'mimes:zip', 'max:1048576'],
        ], [
            'file.mimes' => 'The file must be a backup .zip.',
        ]);

        try {
            $name = $this->backups->import($request->file('file'));
        } catch (Throwable $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => ['file' => [$e->getMessage()]]], 422);
        }

        SystemActivity::record('backup-imported', "Imported database backup {$name}", $request->user(), ['file' => $name]);

        return response()->json(['data' => collect($this->backups->list())->firstWhere('name', $name)], 201);
    }

    public function downloadBackup(Request $request, string $file): StreamedResponse|JsonResponse
    {
        Gate::authorize('manage backups');

        $path = $this->backups->path($file);

        if (! $path) {
            return response()->json(['message' => 'Backup not found.'], 404);
        }

        SystemActivity::record('backup-downloaded', "Downloaded database backup {$file}", $request->user(), ['file' => $file]);

        return $this->backups->disk()->download($path);
    }

    public function destroyBackup(Request $request, string $file): JsonResponse
    {
        Gate::authorize('manage backups');

        if (! $this->backups->delete($file)) {
            return response()->json(['message' => 'Backup not found.'], 404);
        }

        SystemActivity::record('backup-deleted', "Deleted database backup {$file}", $request->user(), ['file' => $file]);

        return response()->json(['message' => 'Backup deleted.']);
    }

    public function restore(Request $request, string $file, DatabaseRestorer $restorer): JsonResponse
    {
        abort_unless($this->isOwner($request->user(), 'restore database'), 403, 'Only an administrator with the "restore database" permission can do this.');

        set_time_limit(0);

        $request->validate([
            'password' => ['required', 'string'],
            'confirmation' => ['required', 'string', 'in:'.self::RESTORE_WORD],
        ], [
            'confirmation.in' => 'Type '.self::RESTORE_WORD.' exactly to confirm.',
        ]);

        $path = $this->backups->absolutePath($file);

        if (! $path) {
            return response()->json(['message' => 'Backup not found.'], 404);
        }

        $actor = $request->user();

        if ($rejection = $this->rejectWrongPassword($request, 'database-restore-denied', 'Database restore refused: wrong password')) {
            return $rejection;
        }

        // Safety net: keep a copy of what is there now. If this fails nothing has been touched.
        try {
            $safety = $this->backups->run();
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => 'The safety backup of the current data failed, so nothing was changed. '.str($e->getMessage())->limit(300)], 500);
        }

        // The backup may not contain this account (or may hold an older password); remember it so access survives.
        $owner = $actor->only(['name', 'email', 'password']);

        try {
            $restorer->restore($path);
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => "{$e->getMessage()} (Safety backup of the current data: {$safety}.)"], 500);
        }

        $this->bringUpToDate($owner, $file);

        return response()->json([
            'message' => 'The backup was restored.',
            'restored' => $file,
            'safety_backup' => $safety,
            // The restored data has its own sessions, so the current one is gone: the app sends you back to sign in.
            'sign_in_again' => true,
        ]);
    }

    public function runSeeder(Request $request): JsonResponse
    {
        abort_unless($this->isOwner($request->user(), 'run seeders'), 403, 'Only an administrator with the "run seeders" permission can do this.');

        $validated = $request->validate([
            'seeder' => ['required', 'string', 'in:'.implode(',', array_keys(self::SEEDERS))],
            'password' => ['required', 'string'],
            'confirmation' => ['required', 'string', 'in:'.self::SEED_WORD],
        ], [
            'confirmation.in' => 'Type '.self::SEED_WORD.' exactly to confirm.',
        ]);

        $label = self::SEEDERS[$validated['seeder']]['label'];

        if ($rejection = $this->rejectWrongPassword($request, 'seeder-denied', "Seeder refused: wrong password ({$label})")) {
            return $rejection;
        }

        try {
            Artisan::call('db:seed', ['--class' => 'Database\\Seeders\\'.$validated['seeder'], '--force' => true]);
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => "The {$label} seeder failed. ".str($e->getMessage())->limit(300)], 500);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        SystemActivity::record('seeder-run', "Ran the {$label} seeder", $request->user(), ['seeder' => $validated['seeder']]);

        return response()->json(['message' => "The {$label} seeder finished."]);
    }

    public function reset(Request $request, DatabaseResetter $resetter): JsonResponse
    {
        abort_unless($this->isOwner($request->user(), 'reset database'), 403, 'Only an administrator with the "reset database" permission can do this.');

        set_time_limit(0);

        $request->validate([
            'password' => ['required', 'string'],
            'confirmation' => ['required', 'string', 'in:'.self::RESET_WORD],
        ], [
            'confirmation.in' => 'Type '.self::RESET_WORD.' exactly to confirm.',
        ]);

        if ($rejection = $this->rejectWrongPassword($request, 'database-reset-denied', 'Database reset refused: wrong password')) {
            return $rejection;
        }

        // Safety net: no backup, no reset. Nothing has been touched yet if this fails.
        try {
            $backup = $this->backups->run();
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => 'The safety backup failed, so nothing was deleted. '.str($e->getMessage())->limit(300)], 500);
        }

        try {
            $result = $resetter->reset($request->user());
        } catch (Throwable $e) {
            report($e);

            return response()->json(['message' => "The reset failed. Your data is safe in the backup {$backup}. ".str($e->getMessage())->limit(300)], 500);
        }

        return response()->json([
            'message' => 'The database has been reset.',
            'backup' => $backup,
            ...$result,
        ]);
    }

    /**
     * Restoring or resetting replaces the whole database, so besides its own permission it always needs the
     * admin role: ticking the permission for another role on the Roles page is not enough.
     */
    private function isOwner(User $user, string $permission): bool
    {
        return $user->hasRole(DatabaseResetter::ADMIN_ROLE) && $user->can($permission);
    }

    private function rejectWrongPassword(Request $request, string $event, string $description): ?JsonResponse
    {
        if (Hash::check((string) $request->input('password'), $request->user()->password)) {
            return null;
        }

        SystemActivity::record($event, $description, $request->user());

        return response()->json(['message' => 'The password is incorrect.', 'errors' => ['password' => ['The password is incorrect.']]], 422);
    }

    /**
     * After the tables are replaced: apply any migrations newer than the backup, make sure roles and permissions
     * exist, and guarantee somebody can still log in as admin.
     *
     * @param  array<string, mixed>  $owner
     */
    private function bringUpToDate(array $owner, string $file): void
    {
        Artisan::call('migrate', ['--force' => true]);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        if (! Role::where('name', DatabaseResetter::ADMIN_ROLE)->exists()) {
            (new RolePermissionSeeder)->run();
        }

        if (! User::role(DatabaseResetter::ADMIN_ROLE)->exists()) {
            $user = User::query()->firstOrCreate(['email' => $owner['email']], $owner);
            $user->forceFill(['password' => $owner['password'], 'email_verified_at' => $user->email_verified_at ?? now()])->save();
            $user->syncRoles([DatabaseResetter::ADMIN_ROLE]);
        }

        SystemActivity::record('database-restored', "Restored the database from backup {$file}", null, ['file' => $file]);
    }
}
