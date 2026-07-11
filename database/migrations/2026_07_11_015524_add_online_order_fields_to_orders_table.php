<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Widen the enum so online orders can be 'delivery' or 'pickup'
            $table->string('type', 20)->default('dine-in')->change();
            $table->text('delivery_address')->nullable()->after('notes');
            $table->decimal('delivery_lat', 10, 7)->nullable()->after('delivery_address');
            $table->decimal('delivery_lng', 10, 7)->nullable()->after('delivery_lat');
            $table->string('payment_method', 20)->nullable()->after('delivery_lng');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['delivery_address', 'delivery_lat', 'delivery_lng', 'payment_method']);
            $table->enum('type', ['dine-in', 'takeout', 'walkin'])->default('dine-in')->change();
        });
    }
};
