<?php

namespace App\Actions\Hr;

use App\Models\Employee;

/**
 * Finds the employee a face descriptor (128 numbers from the browser) belongs to. Matching happens on the server so
 * the stored descriptors are never sent to the public attendance screen.
 */
class MatchFace
{
    /** Euclidean distance below which two descriptors are considered the same person (face-api's default is 0.6). */
    public const MAX_DISTANCE = 0.5;

    /** The runner-up (another person) must be at least this much further away, otherwise the match is ambiguous. */
    public const MIN_MARGIN = 0.05;

    public const DESCRIPTOR_SIZE = 128;

    /**
     * @param  list<float>  $descriptor
     *
     * @throws AttendanceException
     */
    public function handle(array $descriptor): Employee
    {
        $best = null;
        $bestDistance = INF;
        $runnerUp = INF;

        foreach (Employee::where('status', 'active')->whereNotNull('face_descriptors')->get() as $employee) {
            $distance = $this->closest($descriptor, $employee->face_descriptors ?? []);

            if ($distance < $bestDistance) {
                $runnerUp = $bestDistance;
                [$best, $bestDistance] = [$employee, $distance];
            } elseif ($distance < $runnerUp) {
                $runnerUp = $distance;
            }
        }

        if (! $best || $bestDistance > self::MAX_DISTANCE) {
            throw new AttendanceException('Face not recognised. Try again facing the camera, or use your employee ID.');
        }

        if ($runnerUp - $bestDistance < self::MIN_MARGIN) {
            throw new AttendanceException('Could not tell for sure who you are. Please use your employee ID.');
        }

        return $best;
    }

    /**
     * @param  list<float>  $descriptor
     * @param  list<list<float>>  $samples
     */
    private function closest(array $descriptor, array $samples): float
    {
        $closest = INF;

        foreach ($samples as $sample) {
            $sum = 0.0;

            foreach ($descriptor as $i => $value) {
                $sum += (($sample[$i] ?? 0) - $value) ** 2;
            }

            $closest = min($closest, sqrt($sum));
        }

        return $closest;
    }
}
