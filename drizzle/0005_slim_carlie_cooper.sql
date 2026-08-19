CREATE TABLE `projectReviews` (
	`id` varchar(36) NOT NULL,
	`projectId` varchar(36) NOT NULL,
	`sourcePageId` varchar(36) NOT NULL,
	`referenceDocumentId` varchar(36) NOT NULL,
	`label` varchar(160) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectReviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_reviews_context_idx` UNIQUE(`projectId`,`sourcePageId`,`referenceDocumentId`)
);
--> statement-breakpoint
ALTER TABLE `projectReviews` ADD CONSTRAINT `projectReviews_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectReviews` ADD CONSTRAINT `projectReviews_sourcePageId_projectPages_id_fk` FOREIGN KEY (`sourcePageId`) REFERENCES `projectPages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectReviews` ADD CONSTRAINT `projectReviews_referenceDocumentId_projectDocuments_id_fk` FOREIGN KEY (`referenceDocumentId`) REFERENCES `projectDocuments`(`id`) ON DELETE no action ON UPDATE no action;