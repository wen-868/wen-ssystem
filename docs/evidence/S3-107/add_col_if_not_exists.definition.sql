*************************** 1. row ***************************
add_col_if_not_exists
ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
CREATE DEFINER=`zhixiang_app`@`localhost` PROCEDURE `add_col_if_not_exists`(IN tbl VARCHAR(100), IN col VARCHAR(100), IN def TEXT)
BEGIN
  IF NOT EXISTS (SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='liquor_inventory' AND TABLE_NAME=tbl AND COLUMN_NAME=col) THEN
    SET @sql = CONCAT('ALTER TABLE ', tbl, ' ADD COLUMN ', def);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END
utf8mb4
utf8mb4_0900_ai_ci
utf8mb4_0900_ai_ci
