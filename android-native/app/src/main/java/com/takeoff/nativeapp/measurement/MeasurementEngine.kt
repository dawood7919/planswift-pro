package com.takeoff.nativeapp.measurement

import kotlin.math.hypot
import kotlin.math.sqrt

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

    fun scaleFactor(drawingDistance: Double, knownDistance: Double): Double? {
        if (!drawingDistance.isFinite() || !knownDistance.isFinite() || drawingDistance <= 0 || knownDistance <= 0) return null
        return knownDistance / drawingDistance
    }

    fun calibratedLength(drawingLength: Double, factor: Double): Double = drawingLength * factor

    fun calibratedArea(drawingArea: Double, factor: Double): Double = drawingArea * factor * factor

    fun roofArea(flatArea: Double, rise: Double, run: Double): Double {
        require(flatArea.isFinite() && flatArea >= 0) { "المساحة الأفقية غير صالحة." }
        require(rise.isFinite() && rise >= 0 && run.isFinite() && run > 0) { "نسبة الميل يجب أن تكون موجبة." }
        return flatArea * sqrt(1.0 + (rise / run) * (rise / run))
    }

    fun volume(baseArea: Double, depth: Double): Double {
        require(baseArea.isFinite() && baseArea >= 0 && depth.isFinite() && depth > 0) { "المساحة أو العمق غير صالح." }
        return baseArea * depth
    }
}
