# client_features.py

from pymongo import ASCENDING, DESCENDING
from bson import ObjectId

# Function to get clients with optional sorting and filtering
def get_clients(mongo, sort_by="company_name", order="asc", search_query="", created_by=None):
    # Determine sorting order
    sort_order = ASCENDING if order == "asc" else DESCENDING
    # Set up filter criteria
    filter_criteria = {}
    
    # Apply filtering based on search query if provided
    if search_query:
        filter_criteria["company_name"] = {"$regex": search_query, "$options": "i"}
    
    # Filter based on the user who created the client, if provided
    if created_by:
        filter_criteria["created_by"] = created_by
    
    # Fetch and sort clients from MongoDB
    clients = mongo.db.clients.find(filter_criteria).sort(sort_by, sort_order)
    return list(clients)

# Function to get a single client by ID
def get_client_by_id(mongo, client_id):
    # Fetch a single client using its unique ID
    return mongo.db.clients.find_one({"_id": ObjectId(client_id)})

# Function to update client information
def update_client(mongo, client_id, update_data):
    # Update the client document with the provided data
    result = mongo.db.clients.update_one({"_id": ObjectId(client_id)}, {"$set": update_data})
    if result.matched_count:
        return "Client updated successfully."
    else:
        return "Client not found."

# Function to delete a client
def delete_client(mongo, client_id):
    # Delete the client document based on its unique ID
    result = mongo.db.clients.delete_one({"_id": ObjectId(client_id)})
    if result.deleted_count:
        return "Client deleted successfully."
    else:
        return "Client not found."
