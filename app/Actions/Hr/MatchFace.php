<?php

namespace App\Actions\Hr;

use App\Models\Employee;

/**
 * Finds the employee a face descriptor (128 numbers from the browser) belongs to. Matching happens on the server so
 * the stored descriptors are never sent to the public attendance screen.
 */
class MatchFace
{
    /** Length of the face embedding produced in the browser. */
    public const DESCRIPTOR_SIZE = 1024;

    /** Similarity (0–1, the scale used by the Human library: 1 = identical) needed to accept a face. */
    public const MIN_SIMILARITY = 0.6;

    /** The runner-up (a different employee) must score at least this much lower, otherwise the match is ambiguous. */
    public const MIN_MARGIN = 0.05;

    /**
     * @param  list<float>  $descriptor
     *
     * @throws AttendanceException
     */
    public function handle(array $descriptor): Employee
    {
        $best = null;
        $bestScore = 0.0;
        $runnerUp = 0.0;

        foreach (Employee::where('status', 'active')->whereNotNull('face_descriptors')->get() as $employee) {
            $score = $this->bestSimilarity($descriptor, $employee->face_descriptors ?? []);

            if ($score > $bestScore) {
                $runnerUp = $bestScore;
                [$best, $bestScore] = [$employee, $score];
            } elseif ($score > $runnerUp) {
                $runnerUp = $score;
            }
        }

        if (! $best || $bestScore < self::MIN_SIMILARITY) {
            throw new AttendanceException('Face not recognised. Try again facing the camera, or use your employee ID.');
        }

        if ($bestScore - $runnerUp < self::MIN_MARGIN) {
            throw new AttendanceException('Could not tell for sure who you are. Please use your employee ID.');
        }

        return $best;
    }

    /**
     * Same normalisation as Human's `similarity()`: Euclidean distance scaled and mapped from the 0.2–0.8 band onto 0–1.
     *
     * @param  list<float>  $descriptor
     * @param  list<list<float>>  $samples
     */
    private function bestSimilarity(array $descriptor, array $samples): float
    {
        $best = 0.0;

        foreach ($samples as $sample) {
            if (count($sample) !== count($descriptor)) {
                continue;
            }

            $sum = 0.0;

            foreach ($descriptor as $i => $value) {
                $sum += ($sample[$i] - $value) ** 2;
            }

            $root = sqrt(25 * $sum) / 100;
            $best = max($best, max(0.0, min(1.0, (1 - $root - 0.2) / 0.6)));
        }

        return $best;
    }
}
