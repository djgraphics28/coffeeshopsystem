<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Employee extends Model
{
    public const FREQUENCIES = ['daily', 'half_month', 'monthly'];

    public const SALARY_TYPES = ['daily', 'monthly'];

    public const STATUSES = ['active', 'inactive'];

    protected $fillable = [
        'employee_code', 'first_name', 'last_name', 'email', 'phone', 'address', 'birth_date', 'hire_date',
        'position_id', 'status', 'pay_frequency', 'salary_type', 'base_salary', 'shift_start', 'shift_end',
        'vehicle', 'emergency_contact', 'notes', 'user_id', 'face_descriptors', 'face_enrolled_at',
    ];

    /** Biometric data never leaves the server. */
    protected $hidden = ['face_descriptors'];

    protected $casts = [
        'birth_date' => 'date',
        'hire_date' => 'date',
        'base_salary' => 'float',
        'face_descriptors' => 'array',
        'face_enrolled_at' => 'datetime',
    ];

    protected $appends = ['full_name'];

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deliveryMan(): HasOne
    {
        return $this->hasOne(DeliveryMan::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class);
    }

    public function scopeActive($query): void
    {
        $query->where('status', 'active');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /** "EMP-0007" from an id. */
    public static function codeFor(int $id): string
    {
        return 'EMP-'.str_pad((string) $id, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Finds an employee from what was scanned or typed: the full code, any capitalisation, or just the number.
     */
    public static function findByCode(string $input): ?self
    {
        $input = strtoupper(trim($input));

        if ($input === '') {
            return null;
        }

        if (ctype_digit($input)) {
            $input = self::codeFor((int) $input);
        }

        return static::where('employee_code', $input)->first();
    }
}
