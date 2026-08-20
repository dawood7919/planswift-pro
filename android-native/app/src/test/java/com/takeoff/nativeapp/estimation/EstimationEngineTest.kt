package com.takeoff.nativeapp.estimation

import org.junit.Assert.assertEquals
import org.junit.Test

class EstimationEngineTest {
    private fun requireMessage(block: () -> Unit): String = try {
        block()
        throw AssertionError("Expected IllegalArgumentException")
    } catch (error: IllegalArgumentException) {
        error.message.orEmpty()
    }

    @Test
    fun `estimate applies multiplier, item quantity factor, and waste deterministically`() {
        val template = NativeTemplate(
            id = 1L,
            kind = TemplateKind.ASSEMBLY,
            name = "جدار بلوك",
            unit = "m²",
            rate = 2.0,
            costItems = listOf(TemplateCostItem(2L, CostKind.MATERIAL, "بلوك", 12.0, "قطعة", 0.5, 5.0))
        )
        val result = EstimationEngine.estimate(template, measurementQuantity = 10.0, multiplier = 2.0)
        assertEquals(20.0, result.quantity, 0.00001)
        assertEquals(40.0, result.entries[0].cost, 0.00001)
        assertEquals(252.0, result.entries[1].quantity, 0.00001)
        assertEquals(126.0, result.entries[1].cost, 0.00001)
        assertEquals(166.0, result.cost, 0.00001)
    }

    @Test
    fun `estimate rejects a non positive multiplier with a neutral code`() {
        assertEquals(
            EstimationEngine.MULTIPLIER_INVALID,
            requireMessage { EstimationEngine.estimate(NativeTemplate(1L, TemplateKind.PART, "اختبار", "m", 1.0), 1.0, 0.0) }
        )
    }
}
