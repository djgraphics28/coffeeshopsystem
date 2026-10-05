<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    protected $fillable = [
        'employee_id', 'work_date', 'time_in', 'time_out', 'worked_minutes', 'late_minutes', 'overtime_minutes',
        'source', 'ip_address', 'note', 'created_by',
    ];

    protected $casts = [
        'work_date' => 'date',
        'time_in' => 'datetime',
        'time_out' => 'datetime',
        'worked_minutes' => 'integer',
        'late_minutes' => 'integer',
        'overtime_minutes' => 'integer',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function isOpen(): bool
    {
        return $this->time_out === null;
    }
}
