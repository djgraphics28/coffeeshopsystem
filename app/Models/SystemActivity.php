<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One line of the audit trail for system-level actions (backups, restores, database resets).
 */
class SystemActivity extends Model
{
    protected $table = 'system_activity';

    public $timestamps = false;

    protected $fillable = ['event', 'description', 'user_id', 'user_name', 'properties', 'created_at'];

    protected $casts = [
        'properties' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * @param  array<string, mixed>  $properties
     */
    public static function record(string $event, string $description, ?User $user = null, array $properties = []): self
    {
        return static::create([
            'event' => $event,
            'description' => $description,
            'user_id' => $user?->id,
            'user_name' => $user?->name,
            'properties' => $properties ?: null,
            'created_at' => now(),
        ]);
    }
}
