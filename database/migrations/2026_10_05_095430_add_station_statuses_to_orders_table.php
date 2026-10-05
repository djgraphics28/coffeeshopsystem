<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Progress of the kitchen / barista part of the order. Null = not set yet (derived from `status`).
            $table->string('kitchen_status', 20)->nullable()->after('status');
            $table->string('barista_status', 20)->nullable()->after('kitchen_status');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['kitchen_status', 'barista_status']);
        });
    }
};
