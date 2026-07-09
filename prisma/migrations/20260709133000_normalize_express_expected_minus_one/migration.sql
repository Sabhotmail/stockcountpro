-- Express sends -1 when a product line has not been counted yet; store as NULL.
UPDATE "ProductLine" SET "expectedQty" = NULL WHERE "expectedQty" = -1;
