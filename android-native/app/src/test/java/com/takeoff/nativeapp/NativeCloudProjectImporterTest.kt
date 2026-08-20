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

    /**
     * The web app raised the project file to version 2 when it added page dimensions and a
     * coordinate space. Both versions carry the same geometry, so both must still import —
     * rejecting version 2 would silently cut Android off from every new export.
     */
    private fun projectFile(version: Int): String = """
        {
          "format": "takeoff-project",
          "version": $version,
          "exportedAt": "2026-08-20T00:00:00.000Z",
          "project": { "name": "مشروع", "clientName": null, "location": null, "currency": "USD", "lengthUnit": "m" },
          "pages": [{ "sourceId": "page-1", "name": "الدور الأول", "sortOrder": 0, "scaleDrawingDistance": "10", "scaleWorldDistance": "2", "scaleUnit": "m" }],
          "items": [{
            "sourceId": "item-1", "pageSourceId": "page-1", "kind": "COUNT", "name": "علامات",
            "color": "#a78bfa", "geometry": { "marks": [{ "x": 1.0, "y": 1.0 }] }, "rate": "0", "multiplier": "1"
          }]
        }
    """.trimIndent()

    @Test
    fun `imports both supported project file versions`() {
        for (version in 1..2) {
            val imported = NativeCloudProjectImporter.import(projectFile(version))
            assertEquals("مشروع", imported.project.name)
            assertEquals(1, imported.measurements.size)
        }
    }

    @Test
    fun `rejects an unsupported project file version`() {
        for (version in listOf(0, 3, 99)) {
            val failure = runCatching { NativeCloudProjectImporter.import(projectFile(version)) }
            assertEquals(true, failure.isFailure)
        }
    }
}
