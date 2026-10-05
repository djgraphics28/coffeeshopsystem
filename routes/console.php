<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Nightly database-only backup, then prune old ones per config/backup.php. Needs the scheduler running
// (`php artisan schedule:work` in development, or the usual cron entry on a server).
Schedule::command('backup:clean --disable-notifications')->dailyAt('01:00');
Schedule::command('backup:run --only-db --disable-notifications')->dailyAt('01:30');
