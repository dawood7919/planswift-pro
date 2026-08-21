package com.takeoff.nativeapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A sheet's page index is what makes a multi-sheet drawing navigable. It must survive being
 * written to and read back from the local store, or reopening a project collapses every sheet
 * onto the first page.
 */
class PdfPageRenderingTest {
    @Test
    fun `a page keeps the sheet it points at`() {
        val page = NativeProjectPage(1L, "A-102", "file:///plans/site.pdf", 1)
        assertEquals(1, page.pageIndex)
        assertEquals("file:///plans/site.pdf", page.sourceUri)
    }

    @Test
    fun `pages default to the first sheet so older saved projects still load`() {
        assertEquals(0, NativeProjectPage(1L, "A-101", "file:///plans/site.pdf").pageIndex)
    }

    @Test
    fun `sheets of one document are distinguished by index, not by uri`() {
        val source = "file:///plans/site.pdf"
        val sheets = (0 until 3).map { NativeProjectPage(it + 1L, "A-10${it + 1}", source, it) }
        assertEquals(1, sheets.map { it.sourceUri }.toSet().size)
        assertEquals(3, sheets.map { it.pageIndex }.toSet().size)
        assertTrue(sheets.all { it.sourceUri == source })
    }
}
