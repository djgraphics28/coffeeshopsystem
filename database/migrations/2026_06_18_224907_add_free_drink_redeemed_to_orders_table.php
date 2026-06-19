<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('free_drink_redeemed')->default(false)->after('points_redeemed');
            $table->unsignedInteger('cups_awarded')->default(0)->after('free_drink_redeemed');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['free_drink_redeemed', 'cups_awarded']);
        });
    }
};
