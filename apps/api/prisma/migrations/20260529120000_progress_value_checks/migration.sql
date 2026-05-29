ALTER TABLE "progress"
    ADD CONSTRAINT "progress_values_check" CHECK (
        "value_now" >= 0
        AND ("value_max" IS NULL OR "value_max" > 0)
    );
