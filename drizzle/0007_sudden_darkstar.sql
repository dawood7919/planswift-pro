CREATE TABLE `projectVersions` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`label` varchar(160) NOT NULL,
	`snapshotJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_versions_project_label_idx` UNIQUE(`projectId`,`label`)
);
--> statement-breakpoint
ALTER TABLE `projectVersions` ADD CONSTRAINT `projectVersions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;