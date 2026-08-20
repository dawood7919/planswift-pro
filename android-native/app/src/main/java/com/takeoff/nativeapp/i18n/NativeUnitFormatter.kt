package com.takeoff.nativeapp.i18n

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.round

enum class NativeUnitSystem { METRIC, IMPERIAL }

object NativeUnitFormatter {
    private val metersPerUnit = mapOf("m" to 1.0, "ft" to 0.3048, "cm" to 0.01, "in" to 0.0254)
    private const val METERS_PER_FOOT = 0.3048
    private const val METERS_PER_YARD = METERS_PER_FOOT * 3

    private fun number(value: Double, locale: Locale, digits: Int = 2): String = NumberFormat.getNumberInstance(locale).apply {
        maximumFractionDigits = digits
        minimumFractionDigits = 0
    }.format(value)

    private fun meters(value: Double, unit: String): Double = value * (metersPerUnit[unit] ?: 1.0)

    fun length(value: Double, sourceUnit: String, system: NativeUnitSystem, locale: Locale): String {
        val converted = if (system == NativeUnitSystem.METRIC) meters(value, sourceUnit) else meters(value, sourceUnit) / METERS_PER_FOOT
        return "${number(converted, locale)} ${if (system == NativeUnitSystem.METRIC) "m" else "ft"}"
    }

    fun area(value: Double, sourceUnit: String, system: NativeUnitSystem, locale: Locale): String {
        val squareMeters = meters(value, sourceUnit) * meters(1.0, sourceUnit)
        val converted = if (system == NativeUnitSystem.METRIC) squareMeters else squareMeters / (METERS_PER_FOOT * METERS_PER_FOOT)
        return "${number(converted, locale)} ${if (system == NativeUnitSystem.METRIC) "m²" else "SF"}"
    }

    fun volume(value: Double, sourceUnit: String, system: NativeUnitSystem, locale: Locale): String {
        val cubicMeters = meters(value, sourceUnit) * meters(1.0, sourceUnit) * meters(1.0, sourceUnit)
        val converted = if (system == NativeUnitSystem.METRIC) cubicMeters else cubicMeters / (METERS_PER_YARD * METERS_PER_YARD * METERS_PER_YARD)
        return "${number(converted, locale)} ${if (system == NativeUnitSystem.METRIC) "m³" else "CY"}"
    }

    fun feetInches(value: Double): String {
        val sign = if (value < 0) "-" else ""
        val absolute = abs(value)
        var feet = floor(absolute).toInt()
        var inches = round((absolute - feet) * 12).toInt()
        if (inches == 12) { feet += 1; inches = 0 }
        return "$sign$feet' $inches\""
    }
}
