package com.takeoff.nativeapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class NativeCloudProjectImporterTest {
    @Test
    fun `imports page-point project file version two`() {
        val imported = NativeCloudProjectImporter.import(
            """{
              "format":"takeoff-project","version":2,"exportedAt":"2026-08-20T00:00:00.000Z",
              "project":{"name":"مشروع v2","clientName":null,"location":null,"currency":"USD","lengthUnit":"m"},
              "pages":[{"sourceId":"page-v2","name":"مخطط PDF","sortOrder":0,"scaleDrawingDistance":"72","scaleWorldDistance":"1","scaleUnit":"m","pageWidth":"1440.0000","pageHeight":"864.0000","pageRotation":0,"geometrySpace":"PAGE_POINTS"}],
              "items":[{"sourceId":"item-v2","pageSourceId":"page-v2","kind":"LINEAR","name":"جدار","color":"#00aaff","geometry":{"points":[{"x":72,"y":72},{"x":144,"y":72}]},"rate":"0","multiplier":"1"}]
            }""".trimIndent()
        )

        assertEquals("مشروع v2", imported.project.name)
        assertEquals(72.0, imported.measurements.single().value, 0.00001)
        assertNotNull(imported.calibration)
        assertEquals(1.0 / 72.0, imported.calibration!!.factor, 0.00001)
    }

    @Test
    fun `imports cloud project geometry cutouts and calibration deterministically`() {
        val imported = NativeCloudProjectImporter.import(
            CloudProjectFileData(
                projectName = "برج سحابي",
                pages = listOf(CloudProjectPage("page-cloud", "الدور الأول", "10", "2", "m")),
                items = listOf(
                    CloudProjectItem(
                        pageSourceId = "page-cloud",
                        kind = "AREA",
                        geometry = CloudProjectGeometry(
                            rings = listOf(
                                listOf(CloudProjectPoint(0.0, 0.0), CloudProjectPoint(10.0, 0.0), CloudProjectPoint(10.0, 10.0), CloudProjectPoint(0.0, 10.0)),
                                listOf(CloudProjectPoint(2.0, 2.0), CloudProjectPoint(4.0, 2.0), CloudProjectPoint(4.0, 4.0), CloudProjectPoint(2.0, 4.0))
                            )
                        ),
                        multiplier = "2"
                    ),
                    CloudProjectItem(
                        pageSourceId = "page-cloud",
                        kind = "COUNT",
                        geometry = CloudProjectGeometry(marks = listOf(CloudProjectPoint(1.0, 1.0), CloudProjectPoint(5.0, 5.0))),
                        multiplier = "1"
                    )
                )
            )
        )

        assertEquals("برج سحابي", imported.project.name)
        assertEquals(1, imported.project.pages.size)
        assertNotNull(imported.calibration)
        assertEquals(0.2, imported.calibration!!.factor, 0.00001)
        assertEquals(2, imported.measurements.size)
        assertEquals(96.0, imported.measurements[0].value, 0.00001)
        assertEquals(1, imported.measurements[0].cutouts.size)
        assertEquals(2.0, imported.measurements[0].multiplier, 0.00001)
        assertEquals(2.0, imported.measurements[1].value, 0.00001)
    }
}
