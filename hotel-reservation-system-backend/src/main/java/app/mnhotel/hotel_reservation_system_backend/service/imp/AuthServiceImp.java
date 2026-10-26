package app.mnhotel.hotel_reservation_system_backend.service.imp;
import java.time.LocalDateTime;
import java.util.Locale;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import app.mnhotel.hotel_reservation_system_backend.repository.UserRepository;
import app.mnhotel.hotel_reservation_system_backend.entity.User;
import app.mnhotel.hotel_reservation_system_backend.dto.*;
import app.mnhotel.hotel_reservation_system_backend.exception.ApiException;
@Service
public class AuthServiceImp {
    private final UserRepository users;private final PasswordEncoder encoder;
    public AuthServiceImp(UserRepository users,PasswordEncoder encoder){this.users=users;this.encoder=encoder;}
    @Transactional public Views.UserView register(Requests.Register input){return Views.user(create(input,"USER"));}
    public User create(Requests.Register input,String role){
        String name=input.username().trim().toLowerCase(Locale.ROOT),email=input.email().trim().toLowerCase(Locale.ROOT);
        if(input.password().getBytes(StandardCharsets.UTF_8).length>72) throw ApiException.bad("La contraseña debe ocupar como máximo 72 bytes UTF-8");
        if(users.existsByUsernameIgnoreCase(name)||users.existsByEmailIgnoreCase(email))throw ApiException.conflict("El usuario o email ya está registrado");
        User user=new User();user.setUsername(name);user.setEmail(email);user.setPassword(encoder.encode(input.password()));user.setRole(role);user.setCreatedAt(RoomServiceImp.now());
        return users.saveAndFlush(user);
    }
    @Transactional(readOnly=true) public User require(String username){return users.findByUsernameIgnoreCase(username).orElseThrow(()->ApiException.missing("Usuario"));}
}
