CREATE TABLE `projectDocuments` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`originalName` varchar(240) NOT NULL,
	`storageKey` text NOT NULL,
	`storageUrl` text NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`pageCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projectPages` ADD `documentId` varchar(36);--> statement-breakpoint
ALTER TABLE `projectPages` ADD `pdfPageNumber` int;--> statement-breakpoint
ALTER TABLE `projectDocuments` ADD CONSTRAINT `projectDocuments_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;