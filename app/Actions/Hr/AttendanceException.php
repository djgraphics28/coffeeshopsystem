<?php

namespace App\Actions\Hr;

use RuntimeException;

/**
 * A punch that cannot be accepted, with a message that is safe and clear enough to show on the attendance screen.
 */
class AttendanceException extends RuntimeException {}
