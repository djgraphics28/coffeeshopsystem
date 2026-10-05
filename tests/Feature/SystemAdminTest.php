<?php

use App\Actions\Database\DatabaseBackup;
use App\Actions\Database\DatabaseRestorer;
use App\Models\Category;
use App\Models\Customer;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Setting;
use App\Models\SystemActivity;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\delete;
use function Pest\Laravel\get;
use function Pest\Laravel\post;

/**
 * Stands in for the real backup (there is no mysqldump in the test run).
 */
class FakeDatabaseBackup extends DatabaseBackup
{
    public bool $failing = false;

    public int $runs = 0;

    public function run(): string
    {
        $this->runs++;

        if ($this->failing) {
            throw new RuntimeException('mysqldump is not installed');
        }

        return 'fake-backup.zip';
    }

    public function list(): array
    {
        return [['name' => 'fake-backup.zip', 'size' => 2048, 'created_at' => now()->toIso8601String()]];
    }

    public function path(string $name): ?string
    {
        return $name === 'fake-backup.zip' ? 'coffeeshopsystem/fake-backup.zip' : null;
    }

    public function absolutePath(string $name): ?string
    {
        return $name === 'fake-backup.zip' ? '/tmp/does-not-matter.zip' : null;
    }
}

describe('System: backups, restore and reset', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create(['password' => 'secret-pass-123']);
        $this->admin->assignRole('admin');

        $this->backup = new FakeDatabaseBackup;
        app()->instance(DatabaseBackup::class, $this->backup);
    });

    it('is admin-only', function () {
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        get(route('admin.system'))->assertRedirect();

        actingAs($cashier);
        get(route('admin.system'))->assertForbidden();
        post(route('admin.system.backups.store'))->assertForbidden();
        post(route('admin.system.database.reset'), ['password' => 'x', 'confirmation' => 'RESET'])->assertForbidden();
    });

    it('shows the backups, the activity log and what a reset would delete', function () {
        Category::factory()->create();
        SystemActivity::record('backup-created', 'Created database backup x.zip', $this->admin);

        actingAs($this->admin)->get(route('admin.system'))->assertOk()->assertInertia(fn ($page) => $page
            ->component('Admin/System')
            ->has('backups', 1)
            ->where('backups.0.name', 'fake-backup.zip')
            ->has('activity', 1)
            ->where('reset_preview.categories', 1)
            ->where('words.reset', 'RESET'));
    });

    it('creates a backup and records it in the activity log', function () {
        actingAs($this->admin)->postJson(route('admin.system.backups.store'))
            ->assertCreated()
            ->assertJsonPath('data.name', 'fake-backup.zip');

        $this->assertDatabaseHas('system_activity', ['event' => 'backup-created', 'user_id' => $this->admin->id]);
    });

    it('reports a failed backup clearly', function () {
        $this->backup->failing = true;

        actingAs($this->admin)->postJson(route('admin.system.backups.store'))
            ->assertStatus(500)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'mysqldump is not installed'));
    });

    it('deletes a backup and refuses names that could escape the backups folder', function () {
        actingAs($this->admin);

        expect(fn () => delete(route('admin.system.backups.destroy', 'fake-backup.zip')))->not->toThrow(Throwable::class);
        $this->assertDatabaseHas('system_activity', ['event' => 'backup-deleted']);

        get('/admin/system/backups/..%2F..%2F.env/download')->assertStatus(404);
        get('/admin/system/backups/passwd/download')->assertStatus(404);
    });

    it('rejects an uploaded file that is not a backup', function () {
        actingAs($this->admin);
        app()->instance(DatabaseBackup::class, new DatabaseBackup);
        Storage::fake('backups');

        post(route('admin.system.backups.import'), ['file' => UploadedFile::fake()->create('notes.txt', 5)], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('file');

        $path = tempnam(sys_get_temp_dir(), 'zip').'.zip';
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE);
        $zip->addFromString('readme.txt', 'no database here');
        $zip->close();

        post(route('admin.system.backups.import'), ['file' => new UploadedFile($path, 'x.zip', 'application/zip', null, true)], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('errors.file.0', fn (string $m) => str_contains($m, 'does not contain a database dump'));
    });

    it('accepts an uploaded zip that really holds a database dump', function () {
        actingAs($this->admin);
        $real = new DatabaseBackup;
        app()->instance(DatabaseBackup::class, $real);
        Storage::fake('backups');

        $path = tempnam(sys_get_temp_dir(), 'zip').'.zip';
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE);
        $zip->addFromString('db-dumps/mysql-test.sql', "-- dump\nCREATE TABLE `a` (`id` int);\n");
        $zip->close();

        post(route('admin.system.backups.import'), ['file' => new UploadedFile($path, 'x.zip', 'application/zip', null, true)], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.name', fn (string $n) => str_starts_with($n, 'imported-'));

        $this->assertDatabaseHas('system_activity', ['event' => 'backup-imported']);
    });

    describe('permissions', function () {
        $revoke = function (string $permission) {
            Role::findByName('admin')->revokePermissionTo($permission);
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        };

        it('needs view system to open the page, and exposes what the user may do', function () use ($revoke) {
            actingAs($this->admin)->get(route('admin.system'))->assertInertia(fn ($page) => $page
                ->where('can.manage_backups', true)->where('can.restore', true)->where('can.reset', true));

            $revoke('view system');
            actingAs($this->admin)->get(route('admin.system'))->assertForbidden();
        });

        it('needs manage backups for creating, uploading, downloading and deleting backups', function () use ($revoke) {
            $revoke('manage backups');
            actingAs($this->admin);

            post(route('admin.system.backups.store'))->assertForbidden();
            post(route('admin.system.backups.import'))->assertForbidden();
            get(route('admin.system.backups.download', 'fake-backup.zip'))->assertForbidden();
            delete(route('admin.system.backups.destroy', 'fake-backup.zip'))->assertForbidden();

            get(route('admin.system'))->assertInertia(fn ($page) => $page->where('can.manage_backups', false));
        });

        it('needs its own permission for restoring and for resetting', function () use ($revoke) {
            Category::factory()->create();
            $revoke('restore database');
            $revoke('reset database');
            actingAs($this->admin);

            post(route('admin.system.backups.restore', 'fake-backup.zip'), ['password' => 'secret-pass-123', 'confirmation' => 'RESTORE'], ['Accept' => 'application/json'])->assertForbidden();
            post(route('admin.system.database.reset'), ['password' => 'secret-pass-123', 'confirmation' => 'RESET'], ['Accept' => 'application/json'])->assertForbidden();

            expect(Category::count())->toBe(1)->and($this->backup->runs)->toBe(0);
            get(route('admin.system'))->assertInertia(fn ($page) => $page->where('can.restore', false)->where('can.reset', false));
        });
    });

    describe('reset', function () {
        it('needs the password and the typed word, and deletes nothing when they are wrong', function () {
            Category::factory()->create();
            actingAs($this->admin);

            post(route('admin.system.database.reset'), ['password' => 'wrong', 'confirmation' => 'RESET'], ['Accept' => 'application/json'])
                ->assertStatus(422)->assertJsonValidationErrors('password');

            post(route('admin.system.database.reset'), ['password' => 'secret-pass-123', 'confirmation' => 'reset'], ['Accept' => 'application/json'])
                ->assertStatus(422)->assertJsonValidationErrors('confirmation');

            expect(Category::count())->toBe(1)->and($this->backup->runs)->toBe(0);
            $this->assertDatabaseHas('system_activity', ['event' => 'database-reset-denied']);
        });

        it('deletes nothing when the safety backup fails', function () {
            Category::factory()->create();
            $this->backup->failing = true;

            actingAs($this->admin)
                ->postJson(route('admin.system.database.reset'), ['password' => 'secret-pass-123', 'confirmation' => 'RESET'])
                ->assertStatus(500)
                ->assertJsonPath('message', fn (string $m) => str_contains($m, 'nothing was deleted'));

            expect(Category::count())->toBe(1);
        });

        it('keeps only roles, permissions and the admin, clears the rest and re-seeds the settings', function () {
            Storage::fake('public');

            $cashier = User::factory()->create();
            $cashier->assignRole('cashier');
            $category = Category::factory()->create();
            MenuItem::factory()->create(['category_id' => $category->id]);
            Order::factory()->create();
            Customer::create(['name' => 'Customer', 'phone' => '0917', 'email' => 'c@example.com', 'password' => 'x']);
            Setting::set('cafe_name', 'Totally Custom Cafe');
            Setting::set('gcash_qr_path', 'payment-qr/x.png');
            Storage::disk('public')->put('payment-qr/x.png', 'img');
            DB::table('sessions')->insert([
                ['id' => 'admin-session', 'user_id' => $this->admin->id, 'ip_address' => '127.0.0.1', 'user_agent' => 'x', 'payload' => 'x', 'last_activity' => time()],
                ['id' => 'cashier-session', 'user_id' => $cashier->id, 'ip_address' => '127.0.0.1', 'user_agent' => 'x', 'payload' => 'x', 'last_activity' => time()],
            ]);
            $rolesBefore = Role::count();
            $permissionsBefore = DB::table('permissions')->count();
            $grantsBefore = DB::table('role_has_permissions')->count();

            actingAs($this->admin)
                ->postJson(route('admin.system.database.reset'), ['password' => 'secret-pass-123', 'confirmation' => 'RESET'])
                ->assertOk()
                ->assertJsonPath('backup', 'fake-backup.zip')
                ->assertJsonPath('users_kept', 1)
                ->assertJsonPath('users_removed', 1)
                ->assertJsonPath('settings_seeded', true);

            // Kept
            expect(User::count())->toBe(1)
                ->and(User::first()->is($this->admin))->toBeTrue()
                ->and(User::first()->hasRole('admin'))->toBeTrue()
                ->and(Role::count())->toBe($rolesBefore)
                ->and(DB::table('permissions')->count())->toBe($permissionsBefore)
                ->and(DB::table('role_has_permissions')->count())->toBe($grantsBefore)
                ->and(DB::table('sessions')->pluck('id')->all())->toBe(['admin-session']);

            // Cleared
            expect(Category::count())->toBe(0)
                ->and(MenuItem::count())->toBe(0)
                ->and(Order::count())->toBe(0)
                ->and(Customer::count())->toBe(0)
                ->and(DB::table('model_has_roles')->count())->toBe(1);

            // Settings: back to the seeded defaults, uploaded files gone
            expect(Setting::get('cafe_name'))->toBe("Milk&Honey Cafe'")
                ->and(Setting::get('gcash_qr_path'))->toBeNull()
                ->and(Storage::disk('public')->exists('payment-qr/x.png'))->toBeFalse();

            // The audit trail restarts with the reset itself
            expect(SystemActivity::count())->toBe(1)
                ->and(SystemActivity::first()->event)->toBe('database-reset');
        });
    });

    describe('restore', function () {
        it('needs the password and the typed word', function () {
            actingAs($this->admin);

            post(route('admin.system.backups.restore', 'fake-backup.zip'), ['password' => 'wrong', 'confirmation' => 'RESTORE'], ['Accept' => 'application/json'])
                ->assertStatus(422)->assertJsonValidationErrors('password');

            post(route('admin.system.backups.restore', 'fake-backup.zip'), ['password' => 'secret-pass-123', 'confirmation' => 'nope'], ['Accept' => 'application/json'])
                ->assertStatus(422)->assertJsonValidationErrors('confirmation');

            expect($this->backup->runs)->toBe(0);
        });

        it('404s for a backup that does not exist', function () {
            actingAs($this->admin)
                ->postJson(route('admin.system.backups.restore', 'missing.zip'), ['password' => 'secret-pass-123', 'confirmation' => 'RESTORE'])
                ->assertNotFound();
        });

        it('does nothing when the safety backup of the current data fails', function () {
            $this->backup->failing = true;

            actingAs($this->admin)
                ->postJson(route('admin.system.backups.restore', 'fake-backup.zip'), ['password' => 'secret-pass-123', 'confirmation' => 'RESTORE'])
                ->assertStatus(500)
                ->assertJsonPath('message', fn (string $m) => str_contains($m, 'nothing was changed'));
        });
    });
});

describe('Restore screening', function () {
    $run = fn (array $lines) => iterator_to_array(DatabaseRestorer::sanitize($lines), false);

    it('lets a normal mysqldump through', function () use ($run) {
        $dump = [
            "-- MySQL dump 10.13\n",
            "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n",
            "DROP TABLE IF EXISTS `users`;\n",
            "CREATE TABLE `users` (\n",
            "  `id` bigint unsigned NOT NULL AUTO_INCREMENT,\n",
            "  `note` text COMMENT 'system source',\n",
            "  PRIMARY KEY (`id`)\n",
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n",
            "LOCK TABLES `users` WRITE;\n",
            "/*!40000 ALTER TABLE `users` DISABLE KEYS */;\n",
            "INSERT INTO `users` VALUES (1,'system source into outfile');\n",
            "UNLOCK TABLES;\n",
        ];

        expect($run($dump))->toBe($dump);
    });

    it('drops server-wide settings instead of applying them', function () use ($run) {
        expect($run(["SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ 'abc:1-5';\n", "DROP TABLE IF EXISTS `a`;\n"]))->toBe(["DROP TABLE IF EXISTS `a`;\n"]);
    });

    it('refuses anything a normal backup never contains', function (string $line) use ($run) {
        expect(fn () => $run([$line]))->toThrow(RuntimeException::class);
    })->with([
        'shell command' => "system rm -rf /\n",
        'backslash command' => "\\! whoami\n",
        'source file' => "source /etc/passwd\n",
        'grant' => "GRANT ALL ON *.* TO 'x'@'%';\n",
        'drop database' => "DROP DATABASE coffeeshopsystem;\n",
        'use database' => "USE mysql;\n",
        'read server file' => "SELECT LOAD_FILE('/etc/passwd');\n",
        'write server file' => "SELECT 'x' INTO OUTFILE '/tmp/x';\n",
        'trigger in comment' => "/*!50003 CREATE TRIGGER t BEFORE INSERT ON a FOR EACH ROW SET @x=1 */;\n",
        'create user' => "CREATE USER 'hacker'@'%';\n",
    ]);
});
