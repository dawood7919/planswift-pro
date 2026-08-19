CREATE TABLE `pageAnnotations` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`pageId` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`text` varchar(500) NOT NULL,
	`x` decimal(12,4) NOT NULL,
	`y` decimal(12,4) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#FF9C7B',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pageAnnotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `page_annotations_page_position_idx` UNIQUE(`pageId`,`x`,`y`)
);
--> statement-breakpoint
ALTER TABLE `pageAnnotations` ADD CONSTRAINT `pageAnnotations_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pageAnnotations` ADD CONSTRAINT `pageAnnotations_pageId_projectPages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `projectPages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pageAnnotations` ADD CONSTRAINT `pageAnnotations_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;