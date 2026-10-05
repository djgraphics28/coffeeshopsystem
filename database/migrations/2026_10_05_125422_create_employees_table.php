<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_code', 20)->unique();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email')->nullable();
            $table->string('phone', 30)->nullable();
            $table->text('address')->nullable();
            $table->date('birth_date')->nullable();
            $table->date('hire_date')->nullable();
            $table->foreignId('position_id')->constrained()->restrictOnDelete();
            $table->string('status', 20)->default('active');
            // How often they are paid, and how their rate is quoted (per day or per month).
            $table->string('pay_frequency', 20)->default('monthly');
            $table->string('salary_type', 20)->default('monthly');
            $table->decimal('base_salary', 10, 2)->default(0);
            // Scheduled shift; empty means "use the company default" from the HR settings.
            $table->time('shift_start')->nullable();
            $table->time('shift_end')->nullable();
            $table->string('vehicle', 100)->nullable();
            $table->string('emergency_contact')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->index('status');
        });

        // A driver employee is mirrored here so dispatching keeps working from the delivery men list.
        Schema::table('delivery_men', function (Blueprint $table) {
            $table->foreignId('employee_id')->nullable()->unique()->after('user_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('delivery_men', function (Blueprint $table) {
            $table->dropConstrainedForeignId('employee_id');
        });

        Schema::dropIfExists('employees');
    }
};
