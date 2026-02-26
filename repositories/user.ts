import { Repository } from "express-decor/repository"
import UserTable from "../db/tables/user.js";
import type { Database } from "express-decor/database";

export default class UserRepository extends Repository<UserTable> {
  constructor(db: Database) {
    super(db, UserTable);
  }
}