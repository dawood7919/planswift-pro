CREATE TABLE `projectCommands` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`sequence` int NOT NULL,
	`type` varchar(80) NOT NULL,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectCommands_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_commands_sequence_idx` UNIQUE(`projectId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `projectPages` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`scaleDrawingDistance` decimal(16,6),
	`scaleWorldDistance` decimal(16,6),
	`scaleUnit` varchar(8),
	`backgroundUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectPages_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_pages_order_idx` UNIQUE(`projectId`,`sortOrder`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`clientName` varchar(160),
	`location` varchar(200),
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`lengthUnit` varchar(8) NOT NULL DEFAULT 'm',
	`schemaVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_owner_name_idx` UNIQUE(`ownerId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `takeoffItems` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`pageId` varchar(36) NOT NULL,
	`kind` enum('AREA','LINEAR','SEGMENT','COUNT') NOT NULL,
	`name` varchar(160) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#C9FF4A',
	`geometryJson` text NOT NULL,
	`rate` decimal(16,4) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `takeoffItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `takeoff_items_page_name_idx` UNIQUE(`pageId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `projectCommands` ADD CONSTRAINT `projectCommands_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectPages` ADD CONSTRAINT `projectPages_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `takeoffItems` ADD CONSTRAINT `takeoffItems_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `takeoffItems` ADD CONSTRAINT `takeoffItems_pageId_projectPages_id_fk` FOREIGN KEY (`pageId`) REFERENCES `projectPages`(`id`) ON DELETE no action ON UPDATE no action;