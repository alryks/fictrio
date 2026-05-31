ALTER TABLE "books"
ADD COLUMN "pages" SMALLINT;

ALTER TABLE "books"
ADD CONSTRAINT "books_pages_check" CHECK ("pages" IS NULL OR "pages" > 0);
