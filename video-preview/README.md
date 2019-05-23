# floom-example-services

## S3 Bucket Policy
Create an S3 bucket and add the following Policy for allowing Lambda access.
Note that the resource name for s3:ListBucket is different- it does not have the /* suffix.

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "YOUR-LAMBDA-ARN"
            },
            "Action": [
                "S3:GetObject",
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        },
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "YOUR-LAMBDA-ARN"
            },
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
        }
    ]
}
```
