# Documentation
Here is the main documentation page for Discbro.

## Discbro
Discbro is a messaging app similar to Discord, which allows users to create an account, add friends, chat directly with friends, create message groups...

It works using SQLite3 as the database, Express.js as the server, bcrypt as the hasher, and WebSockets (ws) to almost instantaniously send messages between users.
The packages will be checked for vulnerabilities.


## Security
The app currently runs on HTTP. This will change as I create a certificate and key, which will be used to convert it to HTTPS. This makes the app significantly more secure, as passwords will no longer be transmitted over the web in plain-text.

All functionality of the app that requires to be logged in is located under "/app". Profile pictures, stuff that has been uploaded, etc. is not under here, since it should be accessible by anyone. On the other hand, the main page where settings for your profile, chats, server, etc. are located, are all under "/app".
This means that login status should always be checked when entering a page under "/app".


## Functions and what they return
Since I am most used to writing code in C, the system I'm using here is as follows:
If the function ran successfully, 0 is returned. If not, it returns a string with the error that occured.
The thinking behind this is that if an error occured, it should be forwarded to the user who can then decide if they want to try again or just, give up, idk.
If it is an error which should be handled by the server, however, I might choose to return false. If the function can fail in multiple ways i might return a negative number, liker in C, which identifies which error occured.


## Message loading
Messages are loaded in chunks of 32 messages each. Maybe 48? Anyways,
when first entering a channel the two newest chunks are loaded. When scrolling up enough to where you can see the previous chunk, another one is requested, that has the messages for before this chun again. This keep going until there are more than 16 chunks loaded, at this point the older ones start to get unloaded. (they each have an id based of when they where loaded first)
Therefore, if you for exaple jump to a very old message and start scrolling down, new messages will load without having to load EVERYTHING between now and the message you are looking at.
New messages you get are put into a chunk automatically and the chunk grows until it reaches the 32 per chunk limit.
The chunks are stored in an object, with the messages inside.

I ran some tests and concluded with that, chunks are to be calculated when loading messages (simply by selecting the newest 32 for the channel you want, then excluding those in the next selection). By storing the chunk id in the message object you can increase loading times by a tiny bit, but this is far outweighed by the fact that 32 calculations for chunk index have to be done IN REAL TIME (aka slower sending of messages) compared to the one time you need when loading, which should be slower either way.