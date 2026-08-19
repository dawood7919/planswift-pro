CREATE TABLE `templateDependencies` (
	`id` varchar(36) NOT NULL,
	`ownerId` int NOT NULL,
	`templateId` varchar(36) NOT NULL,
	`dependsOnTemplateId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `templateDependencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_dependencies_unique_edge_idx` UNIQUE(`templateId`,`dependsOnTemplateId`),
	CONSTRAINT `template_dependencies_owner_template_idx` UNIQUE(`ownerId`,`templateId`,`dependsOnTemplateId`)
);
--> statement-breakpoint
ALTER TABLE `templateDependencies` ADD CONSTRAINT `templateDependencies_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templateDependencies` ADD CONSTRAINT `templateDependencies_templateId_takeoffTemplates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `takeoffTemplates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templateDependencies` ADD CONSTRAINT `templateDependencies_dependsOnTemplateId_takeoffTemplates_id_fk` FOREIGN KEY (`dependsOnTemplateId`) REFERENCES `takeoffTemplates`(`id`) ON DELETE no action ON UPDATE no action;