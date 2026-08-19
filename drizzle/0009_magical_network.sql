CREATE TABLE `templateCostItems` (
	`id` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`templateId` varchar(36) NOT NULL,
	`kind` enum('MATERIAL','LABOR','EQUIPMENT') NOT NULL,
	`name` varchar(160) NOT NULL,
	`quantityFormula` varchar(500) NOT NULL,
	`unit` varchar(32) NOT NULL DEFAULT 'وحدة',
	`rate` decimal(16,4) NOT NULL DEFAULT '0',
	`wastePercent` decimal(8,4) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templateCostItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_cost_items_template_name_idx` UNIQUE(`templateId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `templateFolders` (
	`id` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `templateFolders_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_folders_owner_name_idx` UNIQUE(`ownerId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `takeoffTemplates` ADD `folderId` varchar(36);--> statement-breakpoint
ALTER TABLE `templateCostItems` ADD CONSTRAINT `templateCostItems_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templateCostItems` ADD CONSTRAINT `templateCostItems_templateId_takeoffTemplates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `takeoffTemplates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templateFolders` ADD CONSTRAINT `templateFolders_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `takeoffTemplates` ADD CONSTRAINT `takeoffTemplates_folderId_templateFolders_id_fk` FOREIGN KEY (`folderId`) REFERENCES `templateFolders`(`id`) ON DELETE no action ON UPDATE no action;