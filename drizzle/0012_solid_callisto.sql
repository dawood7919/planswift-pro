ALTER TABLE `projectPages` ADD `pageWidth` decimal(12,4);--> statement-breakpoint
ALTER TABLE `projectPages` ADD `pageHeight` decimal(12,4);--> statement-breakpoint
ALTER TABLE `projectPages` ADD `pageRotation` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projectPages` ADD `geometrySpace` enum('LEGACY_VIEWBOX','PAGE_POINTS') DEFAULT 'LEGACY_VIEWBOX' NOT NULL;