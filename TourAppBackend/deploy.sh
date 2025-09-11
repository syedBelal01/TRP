#!/bin/bash

# TourApp Backend Deployment Script for EC2
# Run this script on your EC2 instance after uploading your code

set -e  # Exit on any error

echo "🚀 Starting TourApp Backend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as ec2-user"
   exit 1
fi

# Set variables
PROJECT_DIR="/home/ec2-user/tourapp-backend"
SERVICE_NAME="tourapp-backend"
NGINX_CONF="/etc/nginx/conf.d/tourapp.conf"

print_status "Updating system packages..."
sudo dnf update -y

print_status "Installing required packages..."
sudo dnf install -y python3 python3-pip git nginx

print_status "Creating project directory..."
sudo mkdir -p $PROJECT_DIR
sudo chown ec2-user:ec2-user $PROJECT_DIR

print_status "Setting up Python virtual environment..."
cd $PROJECT_DIR
python3 -m venv venv
source venv/bin/activate

print_status "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

print_status "Creating log directories..."
sudo mkdir -p /var/log/tourapp
sudo mkdir -p /var/run/tourapp
sudo chown -R ec2-user:ec2-user /var/log/tourapp
sudo chown -R ec2-user:ec2-user /var/run/tourapp

print_status "Setting up systemd service..."
sudo cp tourapp-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

print_status "Configuring Nginx..."
sudo cp nginx-tourapp.conf $NGINX_CONF

# Replace placeholder domain with actual IP
print_warning "Please update the server_name in $NGINX_CONF with your actual domain or EC2 public IP"

print_status "Testing Nginx configuration..."
sudo nginx -t

print_status "Starting services..."
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl start $SERVICE_NAME

print_status "Checking service status..."
sudo systemctl status $SERVICE_NAME --no-pager

print_status "Checking Nginx status..."
sudo systemctl status nginx --no-pager

print_status "Setting up firewall rules..."
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

print_status "Deployment completed successfully! 🎉"
print_warning "Next steps:"
echo "1. Update server_name in $NGINX_CONF with your domain/IP"
echo "2. Test your API: curl http://your-ec2-ip/health"
echo "3. Update your mobile app to use: http://your-ec2-ip"
echo "4. Check logs: sudo journalctl -u $SERVICE_NAME -f"

# Show current status
echo ""
print_status "Current service status:"
sudo systemctl is-active $SERVICE_NAME
sudo systemctl is-active nginx

echo ""
print_status "Your API should be accessible at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
