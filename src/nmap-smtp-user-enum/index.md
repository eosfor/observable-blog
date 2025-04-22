---
title: 'Nmap SMTP User Enumeration or How ChatGPT Helps Our Work'
date: 2025-03-17T18:59:40-07:00
section: Hacking'n'stuff
---

Some time ago, I wanted to refresh and expand my knowledge of penetration testing. For this purpose, I started taking courses on Hack The Box. Everything went smoothly until the moment I needed to perform SMTP user enumeration. But this story isn’t so much about the enumeration itself—it’s about how ChatGPT helps us fix the tools we use in our challenging work.

<!-- MORE -->


## Introduction

The task seemed straightforward: I had a list of usernames, and I needed to determine which ones existed on an SMTP server. The standard Nmap script, smtp-enum-users, was perfect for this task. Here’s the command I initially used, which theoretically should have solved my problem:

```console
$sudo nmap -Pn -n -p25 -sC --script smtp-enum-users.nse --script-args "smtp-enum-users.methods={VRFY},userdb=./userlist" 10.129.197.249

Starting Nmap 7.94SVN ( https://nmap.org ) at 2025-03-18 02:23 UTC
Nmap scan report for 10.129.197.249
Host is up (0.090s latency).

PORT   STATE SERVICE
25/tcp open  smtp
| smtp-enum-users: 
|_  Couldn't find any accounts

Nmap done: 1 IP address (1 host up) scanned in 6.36 seconds
```

The problem was that I knew for certain at least one user existed on the server. Yet Nmap persistently reported that no accounts were found. Initially, I thought the issue might be with the command arguments, tried various options, but nothing worked.

## ChatGPT Comes to the Rescue

Then I decided to ask ChatGPT, which gave me a great idea: use the --packet-trace option to see exactly what data Nmap was sending to the server. This is where things got interesting:

```console
$sudo nmap -Pn -n -p25 -sC --script '/home/user/repo/htb/labs/nmap/footprinting/smtp-enum-users.nse' --script-args "smtp-enum-users.methods={VRFY},userdb=./userlist" 10.129.131.114 --packet-trace
Starting Nmap 7.94SVN ( https://nmap.org ) at 2025-03-19 03:06 UTC
SENT (0.0634s) TCP 10.10.15.178:54712 > 10.129.131.114:25 S ttl=48 id=9347 iplen=44  seq=2493288949 win=1024 <mss 1460>
RCVD (0.1543s) TCP 10.129.131.114:25 > 10.10.15.178:54712 SA ttl=63 id=0 iplen=44  seq=902777686 win=64240 <mss 1360>
NSOCK INFO [0.0440s] nsock_iod_new2(): nsock_iod_new (IOD #1)
NSOCK INFO [0.1990s] nsock_connect_tcp(): TCP connection requested to 10.129.131.114:25 (IOD #1) EID 8
NSOCK INFO [0.2860s] nsock_trace_handler_callback(): Callback: CONNECT SUCCESS for EID 8 [10.129.131.114:25]
NSE: TCP 10.10.15.178:59690 > 10.129.131.114:25 | CONNECT
NSOCK INFO [0.2860s] nsock_read(): Read request from IOD #1 [10.129.131.114:25] (timeout: 20000ms) EID 18
NSOCK INFO [6.1890s] nsock_trace_handler_callback(): Callback: READ SUCCESS for EID 18 [10.129.131.114:25] (27 bytes): 220 InFreight ESMTP v2.11..
NSE: TCP 10.10.15.178:59690 < 10.129.131.114:25 | 00000000: 32 32 30 20 49 6e 46 72 65 69 67 68 74 20 45 53 220 InFreight ES
00000010: 4d 54 50 20 76 32 2e 31 31 0d 0a                MTP v2.11  

NSE: TCP 10.10.15.178:59690 > 10.129.131.114:25 | 00000000: 45 48 4c 4f 20 6e 6d 61 70 2e 73 63 61 6e 6d 65 EHLO nmap.scanme
00000010: 2e 6f 72 67 0d 0a                               .org  

NSOCK INFO [6.1900s] nsock_write(): Write request for 22 bytes to IOD #1 EID 27 [10.129.131.114:25]
NSOCK INFO [6.1900s] nsock_trace_handler_callback(): Callback: WRITE SUCCESS for EID 27 [10.129.131.114:25]
NSE: TCP 10.10.15.178:59690 > 10.129.131.114:25 | SEND
NSOCK INFO [6.1920s] nsock_readlines(): Read request for 1 lines from IOD #1 [10.129.131.114:25] EID 34
NSOCK INFO [6.2790s] nsock_trace_handler_callback(): Callback: READ SUCCESS for EID 34 [10.129.131.114:25] (156 bytes)
NSE: TCP 10.10.15.178:59690 < 10.129.131.114:25 | 00000000: 32 35 30 2d 6d 61 69 6c 31 0d 0a 32 35 30 2d 50 250-mail1  250-P
00000010: 49 50 45 4c 49 4e 49 4e 47 0d 0a 32 35 30 2d 53 IPELINING  250-S
00000020: 49 5a 45 20 31 30 32 34 30 30 30 30 0d 0a 32 35 IZE 10240000  25
00000030: 30 2d 56 52 46 59 0d 0a 32 35 30 2d 45 54 52 4e 0-VRFY  250-ETRN
00000040: 0d 0a 32 35 30 2d 53 54 41 52 54 54 4c 53 0d 0a   250-STARTTLS  
00000050: 32 35 30 2d 45 4e 48 41 4e 43 45 44 53 54 41 54 250-ENHANCEDSTAT
00000060: 55 53 43 4f 44 45 53 0d 0a 32 35 30 2d 38 42 49 USCODES  250-8BI
00000070: 54 4d 49 4d 45 0d 0a 32 35 30 2d 44 53 4e 0d 0a TMIME  250-DSN  
00000080: 32 35 30 2d 53 4d 54 50 55 54 46 38 0d 0a 32 35 250-SMTPUTF8  25
00000090: 30 20 43 48 55 4e 4b 49 4e 47 0d 0a             0 CHUNKING  

NSE: TCP 10.10.15.178:59690 > 10.129.131.114:25 | 00000000: 56 52 46 59 20 67 72 65 67 6f 72 79 0d 0a       VRFY gregory  

NSOCK INFO [6.2790s] nsock_write(): Write request for 14 bytes to IOD #1 EID 43 [10.129.131.114:25]
NSOCK INFO [6.2790s] nsock_trace_handler_callback(): Callback: WRITE SUCCESS for EID 43 [10.129.131.114:25]
NSE: TCP 10.10.15.178:59690 > 10.129.131.114:25 | SEND
NSOCK INFO [6.2800s] nsock_readlines(): Read request for 1 lines from IOD #1 [10.129.131.114:25] EID 50
NSOCK INFO [6.3680s] nsock_trace_handler_callback(): Callback: READ SUCCESS for EID 50 [10.129.131.114:25] (88 bytes)
NSE: TCP 10.10.15.178:59690 < 10.129.131.114:25 | 550 5.1.1 <gregory>: Recipient address rejected: User unknown in local recipient table

NSE: TCP 10.10.15.178:59690 > 10.129.131.114:25 | 00000000: 51 55 49 54 0d 0a                               QUIT  

NSOCK INFO [6.3690s] nsock_write(): Write request for 6 bytes to IOD #1 EID 59 [10.129.131.114:25]
NSOCK INFO [6.3690s] nsock_trace_handler_callback(): Callback: WRITE SUCCESS for EID 59 [10.129.131.114:25]
NSE: TCP 10.10.15.178:59690 > 10.129.131.114:25 | SEND
NSE: TCP 10.10.15.178:59690 > 10.129.131.114:25 | CLOSE
NSOCK INFO [6.3690s] nsock_iod_delete(): nsock_iod_delete (IOD #1)
Nmap scan report for 10.129.131.114
Host is up (0.091s latency).

PORT   STATE SERVICE
25/tcp open  smtp
| smtp-enum-users: 
|_  Couldn't find any accounts

Nmap done: 1 IP address (1 host up) scanned in 6.37 seconds
```

With this trace, I clearly saw what was happening: the script checked only the first user in the file and then immediately stopped, assuming further checks were pointless. It became obvious there was a bug—or perhaps a “feature”—in the script.

Since I’m not particularly comfortable with Lua and didn’t want to dive deep into fixing the script myself, I asked ChatGPT again, and it quickly pointed out the problematic section of code causing the issue:

```lua
if status == STATUS_CODES.NOTPERMITTED then
    -- Method not permitted, stop checking further users
    break
end
```

The script, upon seeing the “550” error, mistakenly assumed that the VRFY method wasn’t supported at all by the server, rather than simply indicating a specific user didn’t exist.

## Fixing the Feature

I solved this problem simply: I removed the troublesome break statement so the script would not halt prematurely, allowing it to continue checking other users:

```lua
if status == STATUS_CODES.NOTPERMITTED then
    -- Method not permitted for a specific user; skip and continue
    stdnse.print_debug(1, "Method not permitted for user %s", user)
    continue
end
```

## A New Problem – A New Challenge

It seemed the issue was resolved, but then a new problem arose. After several checks, the SMTP server began responding with a 421 error, indicating we’d made too many invalid attempts, requiring a new connection. It looked something like this:

```console
NSOCK INFO [29.9070s] nsock_write(): Write request for 13 bytes to IOD #1 EID 363 [10.129.131.114:25]
NSOCK INFO [29.9070s] nsock_trace_handler_callback(): Callback: WRITE SUCCESS for EID 363 [10.129.131.114:25]
NSE: TCP 10.10.15.178:41264 > 10.129.131.114:25 | SEND
NSOCK INFO [29.9070s] nsock_readlines(): Read request for 1 lines from IOD #1 [10.129.131.114:25] EID 370
NSOCK INFO [31.0340s] nsock_trace_handler_callback(): Callback: READ SUCCESS for EID 370 [10.129.131.114:25] (87 bytes)
NSE: TCP 10.10.15.178:41264 < 10.129.131.114:25 | 550 5.1.1 <rachel>: Recipient address rejected: User unknown in local recipient table

NSE: TCP 10.10.15.178:41264 > 10.129.131.114:25 | 00000000: 56 52 46 59 20 61 64 61 6d 0d 0a                VRFY adam  

NSOCK INFO [31.0350s] nsock_write(): Write request for 11 bytes to IOD #1 EID 379 [10.129.131.114:25]
NSOCK INFO [31.0350s] nsock_trace_handler_callback(): Callback: WRITE SUCCESS for EID 379 [10.129.131.114:25]
NSE: TCP 10.10.15.178:41264 > 10.129.131.114:25 | SEND
NSOCK INFO [31.0360s] nsock_readlines(): Read request for 1 lines from IOD #1 [10.129.131.114:25] EID 386
NSOCK INFO [32.0590s] nsock_trace_handler_callback(): Callback: READ SUCCESS for EID 386 [10.129.131.114:25] (40 bytes): 421 4.7.0 mail1 Error: too many errors..
NSE: TCP 10.10.15.178:41264 < 10.129.131.114:25 | 421 4.7.0 mail1 Error: too many errors

NSE: TCP 10.10.15.178:41264 > 10.129.131.114:25 | 00000000: 56 52 46 59 20 61 64 61 6d 40 6e 6d 61 70 2e 73 VRFY adam@nmap.s
00000010: 63 61 6e 6d 65 2e 6f 72 67 0d 0a                canme.org  

NSOCK INFO [32.0610s] nsock_write(): Write request for 27 bytes to IOD #1 EID 395 [10.129.131.114:25]
NSOCK INFO [32.0610s] nsock_trace_handler_callback(): Callback: WRITE ERROR [Connection reset by peer (104)] for EID 395 [10.129.131.114:25]
NSE: TCP 10.10.15.178:41264 > 10.129.131.114:25 | SEND
NSE: TCP 10.10.15.178:41264 > 10.129.131.114:25 | CLOSE
NSOCK INFO [32.0610s] nsock_iod_delete(): nsock_iod_delete (IOD #1)
Nmap scan report for 10.129.131.114
Host is up (1.5s latency).

PORT   STATE SERVICE
25/tcp open  smtp
| smtp-enum-users_fix1: 
|   Method VRFY is not permitted for user gregory.
|   Method VRFY is not permitted for user sharon.
|   Method VRFY is not permitted for user larry.
|   Method VRFY is not permitted for user angela.
```

Here, the server clearly terminated the connection itself:

> WRITE ERROR [Connection reset by peer (104)] for EID 395 [10.129.131.114:25]

To handle this, I decided to slightly enhance the script — upon receiving a 421 error, it would automatically reconnect and resume checking users, while limiting retry attempts to prevent infinite loops. I won’t describe the entire debugging process here, but I want to emphasize that ChatGPT significantly helped me understand the code. The final result of these efforts can be seen [here](https://github.com/eosfor/nmap/blob/smtp-enum/scripts/smtp-enum-users.nse).

The final working version looks something like this:

```console
$sudo nmap -Pn -n -p25 -sC --script '/home/user/repo/htb/labs/nmap/footprinting/smtp-enum-users-updated.nse' \
    --script-args "smtp-enum-users.methods={VRFY},userdb=./userlist" 10.129.131.114

Starting Nmap 7.94SVN ( https://nmap.org ) at 2025-03-19 02:53 UTC
Nmap scan report for 10.129.131.114
Host is up (0.086s latency).

PORT   STATE SERVICE
25/tcp open  smtp
| smtp-enum-users-updated: 
|   Method VRFY is not permitted for user someuser.
|   Method VRFY is not permitted for user some-other-user.
|   ...
|   Method VRFY returned 252 2.0.0 some_other_user for user some_other_user.
|   Method VRFY is not permitted for user some-other-user2.
|   ...

Nmap done: 1 IP address (1 host up) scanned in 33.03 seconds
```

Now, it’s clear that for some users we get a response code 550 (indicating non-existent users), while for others, we receive 252, indicating they likely exist in the system.

## Conclusion

With ChatGPT’s help, we not only identified precisely what was causing the script to malfunction but successfully fixed it. Now, this utility correctly checks all users from the provided list, gracefully handles errors, and achieves the desired outcome.

So, if something isn’t working as expected, remember — ChatGPT is always nearby, ready to help. Sometimes, all you need is to look at a problem from a fresh perspective.