import { Entity, Column, PrimaryGeneratedColumn, Unique } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity({ name: "protocolDau" })
@Unique(["date", "name", "type"])
export class ProtocolDau extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "int" })
  public readonly id: number;

  @Column({ type: "varchar" })
  public readonly name: string;

  @Column({ type: "int" })
  public readonly amount: number;

  @Column({ type: "date" })
  public readonly date: String;

  // 1: dau, 2: cumulative dau, 3: tvl
  @Column({ type: "smallint", default: 1 })
  public readonly type: number;
}
