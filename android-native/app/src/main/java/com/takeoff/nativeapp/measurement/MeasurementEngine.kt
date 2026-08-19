package com.takeoff.nativeapp.measurement

import kotlin.math.hypot

data class PlanPoint(val x: Float, val y: Float)

object MeasurementEngine {
    fun polylineLength(points: List<PlanPoint>): Double {
        if (points.size < 2) return 0.0
        return points.zipWithNext().sumOf { (from, to) -> hypot((to.x - from.x).toDouble(), (to.y - from.y).toDouble()) }
    }

    fun polygonArea(points: List<PlanPoint>): Double {
        if (points.size < 3) return 0.0
        var signedArea = 0.0
        for (index in points.indices) {
            val current = points[index]
            val next = points[(index + 1) % points.size]
            signedArea += current.x.toDouble() * next.y - next.x.toDouble() * current.y
        }
        return kotlin.math.abs(signedArea) / 2.0
    }
}
