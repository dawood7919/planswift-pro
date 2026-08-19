CREATE TABLE `pageScaleContexts` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`pageId` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`drawingDistance` decimal(16,6) NOT NULL,
	`worldDistance` decimal(16,6) NOT NULL,
	`unit` varchar(8) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pageScaleContexts_id` PRIMARY KEY(`id`),
	CONSTRAINT `page_scale_context_name_idx` UNIQUE(`pageId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `projectPages` ADD `activeScaleContextId` varchar(36);--> statement-breakpoint
ALTER TABLE `pageScaleContexts` ADD CONSTRAINT `pageScaleContexts_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pageScaleContexts` ADD CONSTRAINT `pageScaleContexts_pageId_projectPages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `projectPages`(`id`) ON DELETE no action ON UPDATE no action;