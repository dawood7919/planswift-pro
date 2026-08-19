package com.takeoff.nativeapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class NativeCloudProjectImporterTest {
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
