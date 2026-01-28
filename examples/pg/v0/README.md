# Tables

| Name                        | Columns | Comment                                                         |
| --------------------------- | ------- | --------------------------------------------------------------- |
| [comments](./comments.md)   | 5       | Comments on posts                                               |
| [coupons](./coupons.md)     | 3       | Discount coupons                                                |
| [orders](./orders.md)       | 5       | Orders with optional coupon reference                           |
| [post_tags](./post_tags.md) | 2       | Join table for many-to-many relationship between posts and tags |
| [posts](./posts.md)         | 6       | Blog posts created by users                                     |
| [tags](./tags.md)           | 3       | Tags for categorizing posts                                     |
| [users](./users.md)         | 5       | User accounts table storing basic user information              |

---

## ER Diagram

```mermaid
erDiagram
    posts }o--|| users : "author_id"
    comments }o--|| posts : "post_id"
    comments }o--|| users : "author_id"
    post_tags }o--|| posts : "post_id"
    post_tags }o--|| tags : "tag_id"
    orders }o--|| users : "user_id"
    orders }o--o| coupons : "coupon_id"

    comments {
        serial id PK "Auto-generated unique identifier"
        text body "Comment text"
        int post_id FK "ID of the post this comment belongs to"
        int author_id FK "ID of the user who wrote the comment"
        timestamp created_at "Timestamp when the comment was created"
    }
    coupons {
        uuid id PK "Auto-generated unique identifier"
        varchar code UK "Coupon code"
        int discount_percent "Discount percentage"
    }
    orders {
        uuid id PK "Auto-generated unique identifier"
        int user_id FK "ID of the user who placed the order"
        uuid coupon_id FK "Optional coupon applied to this order (nullable foreign key)"
        int total_cents "Total order amount in cents"
        timestamp created_at "Timestamp when the order was created"
    }
    post_tags {
        int post_id FK "ID of the post"
        int tag_id FK "ID of the tag"
    }
    posts {
        serial id PK "Auto-generated unique identifier"
        varchar title "Post title"
        text content "Post content body"
        boolean published "Whether the post is published"
        int author_id FK "ID of the post author"
        timestamp created_at "Timestamp when the post was created"
    }
    tags {
        serial id PK "Auto-generated unique identifier"
        varchar name UK "Tag name (must be unique)"
        varchar color "Tag color for display"
    }
    users {
        serial id PK "Auto-generated unique identifier"
        varchar name "User's display name"
        varchar email UK "Email address (must be unique)"
        boolean active "Whether the user account is active"
        timestamp created_at "Timestamp when the user was created"
    }
```
