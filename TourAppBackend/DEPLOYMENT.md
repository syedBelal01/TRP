# TourApp Backend Deployment Guide

This guide will help you deploy the TourApp Backend to an EC2 instance.

## Prerequisites

- EC2 instance running Amazon Linux 2023 or similar
- Security group configured to allow HTTP (80) and HTTPS (443) traffic
- Domain name (optional) or EC2 public IP

## Quick Deployment

1. **Upload your code to EC2:**
   ```bash
   # Option 1: Using SCP
   scp -r TourAppBackend/ ec2-user@your-ec2-ip:/home/ec2-user/
   
   # Option 2: Using Git
   git clone <your-repo-url>
   cd tourapp-backend
   ```

2. **Run the deployment script:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Update Nginx configuration:**
   ```bash
   sudo nano /etc/nginx/conf.d/tourapp.conf
   # Replace 'your-domain.com' with your actual domain or EC2 public IP
   ```

4. **Restart services:**
   ```bash
   sudo systemctl restart nginx
   sudo systemctl restart tourapp-backend
   ```

## Manual Deployment Steps

If you prefer to run commands manually:

### 1. Update System
```bash
sudo dnf update -y
sudo dnf install python3 python3-pip git nginx -y
```

### 2. Set Up Project
```bash
cd /home/ec2-user
mkdir tourapp-backend
cd tourapp-backend

# Upload your code here or clone from Git
```

### 3. Set Up Python Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Test Application
```bash
python app.py
# Should show: "MongoDB Atlas connection successful!"
```

### 5. Install and Configure Gunicorn
```bash
pip install gunicorn
gunicorn --config gunicorn.conf.py app:app
```

### 6. Set Up Systemd Service
```bash
sudo cp tourapp-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tourapp-backend
sudo systemctl start tourapp-backend
```

### 7. Configure Nginx
```bash
sudo cp nginx-tourapp.conf /etc/nginx/conf.d/tourapp.conf
sudo nano /etc/nginx/conf.d/tourapp.conf
# Update server_name with your domain/IP

sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 8. Configure Firewall
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Testing Your Deployment

1. **Health Check:**
   ```bash
   curl http://your-ec2-ip/health
   ```

2. **Test API Endpoints:**
   ```bash
   curl -X POST http://your-ec2-ip/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"test123","fullName":"Test User","role":"employee"}'
   ```

## Monitoring and Logs

- **Service Status:** `sudo systemctl status tourapp-backend`
- **Service Logs:** `sudo journalctl -u tourapp-backend -f`
- **Nginx Logs:** `sudo tail -f /var/log/nginx/tourapp_error.log`
- **Application Logs:** `sudo tail -f /var/log/tourapp/error.log`

## Updating Your Application

1. **Stop the service:**
   ```bash
   sudo systemctl stop tourapp-backend
   ```

2. **Update your code:**
   ```bash
   cd /home/ec2-user/tourapp-backend
   # Update your code here
   ```

3. **Install new dependencies:**
   ```bash
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Restart the service:**
   ```bash
   sudo systemctl start tourapp-backend
   ```

## Security Considerations

1. **Change default secrets** in production
2. **Use HTTPS** with SSL certificates
3. **Configure proper firewall rules**
4. **Regular security updates**
5. **Monitor logs for suspicious activity**

## Troubleshooting

### Common Issues:

1. **Service won't start:**
   ```bash
   sudo journalctl -u tourapp-backend -n 50
   ```

2. **Nginx 502 Bad Gateway:**
   - Check if Gunicorn is running: `sudo systemctl status tourapp-backend`
   - Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

3. **Database connection issues:**
   - Verify MongoDB Atlas connection string
   - Check network connectivity
   - Verify database user permissions

4. **Permission issues:**
   ```bash
   sudo chown -R ec2-user:ec2-user /home/ec2-user/tourapp-backend
   sudo chown -R ec2-user:ec2-user /var/log/tourapp
   ```

## Mobile App Configuration

Update your mobile app's API base URL to:
```
http://your-ec2-public-ip
```

Or if using HTTPS:
```
https://your-domain.com
```

## Support

For issues or questions, check the logs first and ensure all services are running properly.
