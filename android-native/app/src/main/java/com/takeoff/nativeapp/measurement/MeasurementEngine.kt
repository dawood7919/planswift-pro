package com.takeoff.nativeapp.measurement

import kotlin.math.hypot
import kotlin.math.sqrt

data class PlanPoint(val x: Float, val y: Float)

object MeasurementEngine {
    const val CUTOUT_AREA_EXCEEDS_OUTER = "CUTOUT_AREA_EXCEEDS_OUTER"
    const val ORIGINAL_OUTER_AREA_INVALID = "ORIGINAL_OUTER_AREA_INVALID"
    const val ORIGINAL_MEASURED_VALUE_INVALID = "ORIGINAL_MEASURED_VALUE_INVALID"
    const val ADJUSTED_FLAT_AREA_INVALID = "ADJUSTED_FLAT_AREA_INVALID"
    const val ROOF_FLAT_AREA_INVALID = "ROOF_FLAT_AREA_INVALID"
    const val ROOF_SLOPE_INVALID = "ROOF_SLOPE_INVALID"
    const val VOLUME_INPUT_INVALID = "VOLUME_INPUT_INVALID"

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

    fun areaWithCutouts(outer: List<PlanPoint>, cutouts: List<List<PlanPoint>>): Double {
        val outerArea = polygonArea(outer)
        val cutoutArea = cutouts.sumOf(::polygonArea)
        require(cutoutArea <= outerArea) { CUTOUT_AREA_EXCEEDS_OUTER }
        return outerArea - cutoutArea
    }

    fun adjustAreaValueProportionally(originalOuterArea: Double, originalMeasuredValue: Double, adjustedFlatArea: Double): Double {
        require(originalOuterArea.isFinite() && originalOuterArea > 0) { ORIGINAL_OUTER_AREA_INVALID }
        require(originalMeasuredValue.isFinite() && originalMeasuredValue >= 0) { ORIGINAL_MEASURED_VALUE_INVALID }
        require(adjustedFlatArea.isFinite() && adjustedFlatArea >= 0) { ADJUSTED_FLAT_AREA_INVALID }
        return originalMeasuredValue * adjustedFlatArea / originalOuterArea
    }

    fun canAddCutout(outer: List<PlanPoint>, existingCutouts: List<List<PlanPoint>>, candidate: List<PlanPoint>): Boolean {
        if (!isSimpleLoop(candidate) || outer.size < 3 || polygonArea(outer) <= EPSILON) return false
        if (candidate.any { point -> !isStrictlyInside(point, outer) } || loopsIntersect(candidate, outer)) return false
        return existingCutouts.none { existing ->
            loopsIntersect(candidate, existing) ||
                candidate.any { point -> isInsideOrOnBoundary(point, existing) } ||
                existing.any { point -> isInsideOrOnBoundary(point, candidate) }
        }
    }

    fun scaleFactor(drawingDistance: Double, knownDistance: Double): Double? {
        if (!drawingDistance.isFinite() || !knownDistance.isFinite() || drawingDistance <= 0 || knownDistance <= 0) return null
        return knownDistance / drawingDistance
    }

    fun calibratedLength(drawingLength: Double, factor: Double): Double = drawingLength * factor

    fun calibratedArea(drawingArea: Double, factor: Double): Double = drawingArea * factor * factor

    fun roofArea(flatArea: Double, rise: Double, run: Double): Double {
        require(flatArea.isFinite() && flatArea >= 0) { ROOF_FLAT_AREA_INVALID }
        require(rise.isFinite() && rise >= 0 && run.isFinite() && run > 0) { ROOF_SLOPE_INVALID }
        return flatArea * sqrt(1.0 + (rise / run) * (rise / run))
    }

    fun volume(baseArea: Double, depth: Double): Double {
        require(baseArea.isFinite() && baseArea >= 0 && depth.isFinite() && depth > 0) { VOLUME_INPUT_INVALID }
        return baseArea * depth
    }

    private fun isSimpleLoop(points: List<PlanPoint>): Boolean {
        if (points.size < 3 || polygonArea(points) <= EPSILON) return false
        return points.indices.none { firstEdge ->
            (firstEdge + 1 until points.size).any { secondEdge ->
                !areAdjacentEdges(firstEdge, secondEdge, points.size) && segmentsIntersect(
                    points[firstEdge],
                    points[(firstEdge + 1) % points.size],
                    points[secondEdge],
                    points[(secondEdge + 1) % points.size]
                )
            }
        }
    }

    private fun areAdjacentEdges(first: Int, second: Int, size: Int): Boolean =
        first == second || (first + 1) % size == second || (second + 1) % size == first

    private fun loopsIntersect(first: List<PlanPoint>, second: List<PlanPoint>): Boolean {
        if (first.size < 2 || second.size < 2) return false
        return first.indices.any { firstEdge ->
            second.indices.any { secondEdge ->
                segmentsIntersect(
                    first[firstEdge],
                    first[(firstEdge + 1) % first.size],
                    second[secondEdge],
                    second[(secondEdge + 1) % second.size]
                )
            }
        }
    }

    private fun isStrictlyInside(point: PlanPoint, polygon: List<PlanPoint>): Boolean =
        !polygon.indices.any { edge -> pointOnSegment(point, polygon[edge], polygon[(edge + 1) % polygon.size]) } &&
            isInsideOrOnBoundary(point, polygon)

    private fun isInsideOrOnBoundary(point: PlanPoint, polygon: List<PlanPoint>): Boolean {
        if (polygon.size < 3) return false
        var inside = false
        for (index in polygon.indices) {
            val from = polygon[index]
            val to = polygon[(index + 1) % polygon.size]
            if (pointOnSegment(point, from, to)) return true
            val crossesRay = (from.y > point.y) != (to.y > point.y)
            if (crossesRay) {
                val intersectionX = (to.x - from.x).toDouble() * (point.y - from.y).toDouble() / (to.y - from.y).toDouble() + from.x
                if (point.x < intersectionX) inside = !inside
            }
        }
        return inside
    }

    private fun segmentsIntersect(a: PlanPoint, b: PlanPoint, c: PlanPoint, d: PlanPoint): Boolean {
        val first = orientation(a, b, c)
        val second = orientation(a, b, d)
        val third = orientation(c, d, a)
        val fourth = orientation(c, d, b)
        if (first * second < 0 && third * fourth < 0) return true
        return (kotlin.math.abs(first) <= EPSILON && pointOnSegment(c, a, b)) ||
            (kotlin.math.abs(second) <= EPSILON && pointOnSegment(d, a, b)) ||
            (kotlin.math.abs(third) <= EPSILON && pointOnSegment(a, c, d)) ||
            (kotlin.math.abs(fourth) <= EPSILON && pointOnSegment(b, c, d))
    }

    private fun orientation(a: PlanPoint, b: PlanPoint, c: PlanPoint): Double =
        (b.x - a.x).toDouble() * (c.y - a.y) - (b.y - a.y).toDouble() * (c.x - a.x)

    private fun pointOnSegment(point: PlanPoint, from: PlanPoint, to: PlanPoint): Boolean {
        if (kotlin.math.abs(orientation(from, to, point)) > EPSILON) return false
        return point.x >= minOf(from.x, to.x) - EPSILON && point.x <= maxOf(from.x, to.x) + EPSILON &&
            point.y >= minOf(from.y, to.y) - EPSILON && point.y <= maxOf(from.y, to.y) + EPSILON
    }

    private const val EPSILON = 0.00001
}
