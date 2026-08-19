CREATE TABLE `takeoffTemplates` (
	`id` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`kind` enum('PART','ASSEMBLY') NOT NULL,
	`name` varchar(160) NOT NULL,
	`formula` varchar(500) NOT NULL,
	`unit` varchar(32) NOT NULL DEFAULT 'وحدة',
	`rate` decimal(16,4) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `takeoffTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `takeoff_templates_owner_name_idx` UNIQUE(`ownerId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `takeoffItems` ADD `templateId` varchar(36);--> statement-breakpoint
ALTER TABLE `takeoffTemplates` ADD CONSTRAINT `takeoffTemplates_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `takeoffItems` ADD CONSTRAINT `takeoffItems_templateId_takeoffTemplates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `takeoffTemplates`(`id`) ON DELETE no action ON UPDATE no action;