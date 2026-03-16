import { Repository } from "express-decor/repository"
import type { Database } from "express-decor/database";
import UserTable from "../database/tables/user.js";

export default class UserRepository extends Repository<UserTable> {
  constructor(db: Database) {
    super(db, UserTable);
  }
}