package com.takeoff.nativeapp

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class NativeCloudPdfDownloadTest {
    @Test
    fun `accepts only a downloaded file with PDF signature`() {
        val valid = File.createTempFile("takeoff-valid", ".pdf")
        val invalid = File.createTempFile("takeoff-invalid", ".pdf")
        try {
            valid.writeBytes("%PDF-1.7\n".toByteArray())
            invalid.writeBytes("not-a-pdf".toByteArray())

            assertTrue(NativeCloudApi.hasPdfSignature(valid))
            assertFalse(NativeCloudApi.hasPdfSignature(invalid))
        } finally {
            valid.delete()
            invalid.delete()
        }
    }
}
