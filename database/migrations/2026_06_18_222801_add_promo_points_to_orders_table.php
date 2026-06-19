<?php

use App\Models\Promo;
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
            $table->foreignId('promo_id')->nullable()->after('customer_id')->constrained('promos')->nullOnDelete();
            $table->unsignedInteger('points_earned')->default(0)->after('discount');
            $table->unsignedInteger('points_redeemed')->default(0)->after('points_earned');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeignIdFor(Promo::class);
            $table->dropColumn(['points_earned', 'points_redeemed']);
        });
    }
};
