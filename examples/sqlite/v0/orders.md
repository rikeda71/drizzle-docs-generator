# orders

## orders

Orders with optional coupon reference

### Columns

| Name        | Type    | Default | Nullable | Children | Parents                    | Comment                                                      |
| ----------- | ------- | ------- | -------- | -------- | -------------------------- | ------------------------------------------------------------ |
| **id**      | integer | -       | NO       | -        | -                          | Auto-generated unique identifier                             |
| user_id     | integer | -       | NO       | -        | [users.id](./users.md)     | ID of the user who placed the order                          |
| coupon_id   | integer | -       | YES      | -        | [coupons.id](./coupons.md) | Optional coupon applied to this order (nullable foreign key) |
| total_cents | integer | -       | NO       | -        | -                          | Total order amount in cents                                  |
| created_at  | integer | -       | YES      | -        | -                          | Timestamp when the order was created                         |

### Constraints

| Name                 | Type        | Definition                |
| -------------------- | ----------- | ------------------------- |
| fk_user_id_users     | FOREIGN KEY | (user_id) → users(id)     |
| fk_coupon_id_coupons | FOREIGN KEY | (coupon_id) → coupons(id) |

### Indexes

| Name            | Columns | Unique | Type |
| --------------- | ------- | ------ | ---- |
| orders_user_idx | user_id | NO     | -    |

### Relations

| Parent                     | Child                               | Type        |
| -------------------------- | ----------------------------------- | ----------- |
| [users.id](./users.md)     | **[orders.user_id](./orders.md)**   | Many to One |
| [coupons.id](./coupons.md) | **[orders.coupon_id](./orders.md)** | Many to One |
