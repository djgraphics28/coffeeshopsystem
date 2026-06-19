<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $defaults = [
            'mail_host' => env('MAIL_HOST', ''),
            'mail_port' => env('MAIL_PORT', '587'),
            'mail_username' => env('MAIL_USERNAME', ''),
            'mail_password' => env('MAIL_PASSWORD', ''),
            'mail_encryption' => env('MAIL_ENCRYPTION', 'tls'),
            'mail_from_address' => env('MAIL_FROM_ADDRESS', ''),
            'mail_from_name' => env('MAIL_FROM_NAME', env('APP_NAME', '')),
            'pusher_app_id' => env('PUSHER_APP_ID', ''),
            'pusher_app_key' => env('PUSHER_APP_KEY', ''),
            'pusher_app_secret' => env('PUSHER_APP_SECRET', ''),
            'pusher_app_cluster' => env('PUSHER_APP_CLUSTER', 'ap1'),
        ];

        foreach ($defaults as $key => $value) {
            DB::table('settings')->updateOrInsert(
                ['key' => $key],
                ['key' => $key, 'value' => (string) $value, 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    public function down(): void
    {
        DB::table('settings')->whereIn('key', [
            'mail_host', 'mail_port', 'mail_username', 'mail_password',
            'mail_encryption', 'mail_from_address', 'mail_from_name',
            'pusher_app_id', 'pusher_app_key', 'pusher_app_secret', 'pusher_app_cluster',
        ])->delete();
    }
};
